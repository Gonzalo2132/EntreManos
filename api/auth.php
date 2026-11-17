<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
$pdo = null;

$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $isHttps,
    'samesite' => 'Lax',
    'path' => '/',
]);
session_start();

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function publicUser(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'neighborhood_id' => (int) $user['neighborhood_id'],
        'neighborhood_name' => $user['neighborhood_name'],
    ];
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['error' => 'Método no permitido.']);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        respond(400, ['error' => 'La solicitud no tiene un formato válido.']);
    }

    $action = $input['action'] ?? '';
    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
        respond(200, ['ok' => true]);
    }

    if (!in_array($action, ['me', 'neighborhoods', 'register', 'login'], true)) {
        respond(400, ['error' => 'La operación solicitada no es válida.']);
    }

    if ($action === 'me' && empty($_SESSION['user']['id'])) {
        respond(200, ['user' => null]);
    }

    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $database = getenv('DB_NAME') ?: 'entremanos';
    $username = getenv('DB_USER') ?: 'root';
    $password = getenv('DB_PASSWORD') ?: '';
    $pdo = new PDO(
        "mysql:host={$host};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    if ($action === 'neighborhoods') {
        $statement = $pdo->query('SELECT id, name FROM neighborhoods ORDER BY name');
        respond(200, ['neighborhoods' => $statement->fetchAll()]);
    }

    if ($action === 'me') {
        $statement = $pdo->prepare(
            'SELECT u.id, u.name, u.email, u.neighborhood_id, n.name AS neighborhood_name
             FROM users u
             JOIN neighborhoods n ON n.id = u.neighborhood_id
             WHERE u.id = :id'
        );
        $statement->execute(['id' => (int) $_SESSION['user']['id']]);
        $user = $statement->fetch();
        if (!$user) {
            $_SESSION = [];
            respond(200, ['user' => null]);
        }
        $_SESSION['user'] = publicUser($user);
        respond(200, ['user' => $_SESSION['user']]);
    }

    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $passwordInput = (string) ($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        respond(422, ['error' => 'Ingresá un correo electrónico válido.']);
    }
    if (strlen($passwordInput) < 8 || strlen($passwordInput) > 72) {
        respond(422, ['error' => 'La contraseña debe tener entre 8 y 72 caracteres.']);
    }

    if ($action === 'register') {
        $name = trim((string) ($input['name'] ?? ''));
        if (!preg_match('/^.{2,32}$/us', $name)) {
            respond(422, ['error' => 'El nombre debe tener entre 2 y 32 caracteres.']);
        }

        $pdo->beginTransaction();
        $neighborhoodId = null;
        if (($input['neighborhood_id'] ?? '') === 'create') {
            $neighborhoodName = trim((string) ($input['neighborhood_name'] ?? ''));
            if (!preg_match('/^.{2,60}$/us', $neighborhoodName)) {
                respond(422, ['error' => 'El nombre del vecindario debe tener entre 2 y 60 caracteres.']);
            }
            try {
                $statement = $pdo->prepare('INSERT INTO neighborhoods (name) VALUES (:name)');
                $statement->execute(['name' => $neighborhoodName]);
                $neighborhoodId = (int) $pdo->lastInsertId();
            } catch (PDOException $error) {
                if ($error->getCode() === '23000') {
                    $pdo->rollBack();
                    respond(409, ['error' => 'Ya existe un vecindario con ese nombre. Elegilo de la lista.']);
                }
                throw $error;
            }
        } else {
            $neighborhoodId = filter_var(
                $input['neighborhood_id'] ?? null,
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );
            if ($neighborhoodId === false) {
                respond(422, ['error' => 'Elegí un vecindario para continuar.']);
            }
            $statement = $pdo->prepare('SELECT id FROM neighborhoods WHERE id = :id');
            $statement->execute(['id' => $neighborhoodId]);
            if (!$statement->fetch()) {
                respond(422, ['error' => 'El vecindario seleccionado no existe. Actualizá la página e intentá de nuevo.']);
            }
        }

        $statement = $pdo->prepare(
            'INSERT INTO users (name, email, password_hash, neighborhood_id)
             VALUES (:name, :email, :password_hash, :neighborhood_id)'
        );
        try {
            $statement->execute([
                'name' => $name,
                'email' => $email,
                'password_hash' => password_hash($passwordInput, PASSWORD_DEFAULT),
                'neighborhood_id' => $neighborhoodId,
            ]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                $pdo->rollBack();
                respond(409, ['error' => 'Ya existe una cuenta con ese correo electrónico.']);
            }
            throw $error;
        }

        $statement = $pdo->prepare('SELECT id, name FROM neighborhoods WHERE id = :id');
        $statement->execute(['id' => $neighborhoodId]);
        $neighborhood = $statement->fetch();
        $pdo->commit();
        respond(201, ['ok' => true, 'neighborhood' => $neighborhood]);
    }

    $statement = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.password_hash, u.neighborhood_id, n.name AS neighborhood_name
         FROM users u
         JOIN neighborhoods n ON n.id = u.neighborhood_id
         WHERE u.email = :email'
    );
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();
    if (!$user || !password_verify($passwordInput, $user['password_hash'])) {
        respond(401, ['error' => 'El correo o la contraseña no son correctos.']);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = publicUser($user);
    respond(200, ['user' => $_SESSION['user']]);
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('EntreManos auth error: ' . $error->getMessage());
    respond(500, ['error' => 'No se pudo completar la operación. Verificá la conexión con la base de datos.']);
}
