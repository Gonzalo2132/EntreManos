<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
$pdo = null;

$segura = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $segura,
    'samesite' => 'Lax',
    'path' => '/',
]);
session_start();

function responder(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function obtenerUsuarioPublico(array $user): array
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
        responder(405, ['error' => 'Método no permitido.']);
    }

    $entrada = json_decode(file_get_contents('php://input'), true);
    if (!is_array($entrada)) {
        responder(400, ['error' => 'La solicitud no tiene un formato válido.']);
    }

    $accion = $entrada['action'] ?? '';
    if ($accion === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => '/',
                'secure' => $segura,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
        responder(200, ['ok' => true]);
    }

    if (!in_array($accion, ['me', 'neighborhoods', 'register', 'login'], true)) {
        responder(400, ['error' => 'La operación solicitada no es válida.']);
    }
    if ($accion === 'me' && empty($_SESSION['user']['id'])) {
        responder(200, ['user' => null]);
    }

    $servidor = getenv('DB_HOST') ?: '127.0.0.1';
    $base = getenv('DB_NAME') ?: 'entremanos';
    $usuario = getenv('DB_USER') ?: 'root';
    $clave = getenv('DB_PASSWORD') ?: '';
    $pdo = new PDO(
        "mysql:host=$servidor;dbname=$base;charset=utf8mb4",
        $usuario,
        $clave,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    if ($accion === 'neighborhoods') {
        responder(200, ['neighborhoods' => $pdo->query('SELECT id, nombre AS name FROM vecindarios ORDER BY nombre')->fetchAll()]);
    }

    $email = strtolower(trim((string) ($entrada['email'] ?? '')));
    $contrasena = (string) ($entrada['password'] ?? '');
    if ($accion !== 'me' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254)) {
        responder(422, ['error' => 'Ingresá un correo electrónico válido.']);
    }
    if ($accion !== 'me' && (strlen($contrasena) < 8 || strlen($contrasena) > 72)) {
        responder(422, ['error' => 'La contraseña debe tener entre 8 y 72 caracteres.']);
    }

    if ($accion === 'register') {
        $nombre = trim((string) ($entrada['name'] ?? ''));
        if (!preg_match('/^.{2,32}$/us', $nombre)) {
            responder(422, ['error' => 'El nombre debe tener entre 2 y 32 caracteres.']);
        }

        $crearVecindario = ($entrada['neighborhood_id'] ?? '') === 'create';
        $nombreVecindario = trim((string) ($entrada['neighborhood_name'] ?? ''));
        $idVecindario = filter_var(
            $entrada['neighborhood_id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );
        if ($crearVecindario && !preg_match('/^.{2,60}$/us', $nombreVecindario)) {
            responder(422, ['error' => 'El nombre del vecindario debe tener entre 2 y 60 caracteres.']);
        }
        if (!$crearVecindario && $idVecindario === false) {
            responder(422, ['error' => 'Elegí un vecindario para continuar.']);
        }

        $pdo->beginTransaction();
        $mensajeDuplicado = 'Ya existe una cuenta con ese correo electrónico.';
        try {
            if ($crearVecindario) {
                $mensajeDuplicado = 'Ya existe un vecindario con ese nombre. Elegilo de la lista.';
                $consulta = $pdo->prepare('INSERT INTO vecindarios (nombre) VALUES (:name)');
                $consulta->execute(['name' => $nombreVecindario]);
                $vecindario = ['id' => (int) $pdo->lastInsertId(), 'name' => $nombreVecindario];
            } else {
                $consulta = $pdo->prepare('SELECT id, nombre AS name FROM vecindarios WHERE id = :id');
                $consulta->execute(['id' => $idVecindario]);
                $vecindario = $consulta->fetch();
                if (!$vecindario) {
                    $pdo->rollBack();
                    responder(422, ['error' => 'El vecindario seleccionado no existe. Actualizá la página e intentá de nuevo.']);
                }
            }

            $consulta = $pdo->prepare(
                'INSERT INTO usuarios (nombre, correo, contrasena_cifrada, vecindario_id)
                 VALUES (:name, :email, :password_hash, :neighborhood_id)'
            );
            $consulta->execute([
                'name' => $nombre,
                'email' => $email,
                'password_hash' => password_hash($contrasena, PASSWORD_DEFAULT),
                'neighborhood_id' => (int) $vecindario['id'],
            ]);
            $pdo->commit();
        } catch (PDOException $error) {
            if ($error->getCode() !== '23000') {
                throw $error;
            }
            $pdo->rollBack();
            responder(409, ['error' => $mensajeDuplicado]);
        }

        responder(201, ['ok' => true, 'neighborhood' => $vecindario]);
    }

    $columna = $accion === 'me' ? 'u.id' : 'u.correo';
    $valor = $accion === 'me' ? (int) $_SESSION['user']['id'] : $email;
    $campos = $accion === 'me'
        ? 'u.id, u.nombre AS name, u.correo AS email, u.vecindario_id AS neighborhood_id, v.nombre AS neighborhood_name'
        : 'u.id, u.nombre AS name, u.correo AS email, u.contrasena_cifrada AS password_hash, u.vecindario_id AS neighborhood_id, v.nombre AS neighborhood_name';
    $consulta = $pdo->prepare(
        "SELECT $campos FROM usuarios u JOIN vecindarios v ON v.id = u.vecindario_id WHERE $columna = :valor"
    );
    $consulta->execute(['valor' => $valor]);
    $user = $consulta->fetch();
    if (!$user && $accion === 'me') {
        $_SESSION = [];
        responder(200, ['user' => null]);
    }
    if (!$user || ($accion === 'login' && !password_verify($contrasena, $user['password_hash']))) {
        responder(401, ['error' => 'El correo o la contraseña no son correctos.']);
    }

    $usuarioPublico = obtenerUsuarioPublico($user);
    if ($accion === 'login') {
        session_regenerate_id(true);
    }
    $_SESSION['user'] = $usuarioPublico;
    responder(200, ['user' => $usuarioPublico]);
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('EntreManos auth error: ' . $error->getMessage());
    responder(500, ['error' => 'No se pudo completar la operación. Verificá la conexión con la base de datos.']);
}
