// Servidor WebSocket para el sistema de avisos (Parte 3)
var http = require("http");
var jwt = require("jwt-simple");
var clave = "miSecretoMasOscuro"; // La misma clave que utiliza el login REST.
var httpServer = http.createServer();

// Crear servidor WS
var WebSocketServer = require("websocket").server;
var wsServer = new WebSocketServer({
    httpServer: httpServer
});

// Conexion con MySQL
var conexionBD = require("./conexion_mysql.js");

// Iniciar el servidor HTTP en un puerto
var puertoWS = 4444;

httpServer.listen(puertoWS, function () {
    console.log("Servidor WebSocket iniciado en puerto:", puertoWS);
});


// Array de clientes conectados
// Cada cliente tiene:
// { connection, tipo, id, nombre }
var clientes = [];

// ============================================================
// CONEXIONES WEBSOCKET
// ============================================================

wsServer.on("request", function (request) {

    // Aceptamos la conexion usando el protocolo "avisos"
    var connection = request.accept("avisos", request.origin);

    var cliente = {
        connection: connection,
        tipo: null,
        id: null,
        nombre: null
    };

    clientes.push(cliente);

    console.log("Cliente WS conectado. Ahora son:", clientes.length);


    // Cuando el cliente manda un mensaje
    connection.on("message", function (message) {

        // Solo aceptamos mensajes de texto
        if (message.type !== "utf8") {
            return;
        }

        var msg;
        try {
            msg = JSON.parse(message.utf8Data);
        } catch (error) {
            connection.close(1008, "Mensaje no valido");
            return;
        }
        if (!msg || typeof msg !== "object") {
            connection.close(1008, "Mensaje no valido");
            return;
        }


        // El cliente se identifica
        if (msg.operacion === "identificar") {

            // El gestor debe presentar el token recibido al iniciar sesion.
            if (msg.tipo === "gestor") {
                try {
                    var datos = jwt.decode(msg.token, clave);
                    if (!datos || !datos.id || !Number.isFinite(datos.expira) ||
                        datos.expira <= Date.now()) {
                        throw new Error("Token no valido o caducado");
                    }
                } catch (error) {
                    // Borramos la identificacion antes de cerrar la conexion.
                    cliente.tipo = null;
                    connection.close(1008, "Token no valido o caducado");
                    return;
                }

                // La identidad procede del token firmado, no del id del mensaje.
                cliente.id = datos.id;
                cliente.expira = datos.expira;
            } else if (msg.tipo === "sanitario") {
                cliente.id = Number(msg.id);
            } else {
                cliente.tipo = null;
                connection.close(1008, "Tipo de cliente no valido");
                return;
            }
            cliente.tipo = msg.tipo;
            cliente.nombre = msg.nombre;

            console.log(
                "Se ha identificado:",
                cliente.tipo,
                cliente.id,
                cliente.nombre
            );
        }
    });


    // Cuando el cliente se desconecta
    connection.on("close", function () {

        var pos = clientes.indexOf(cliente);

        if (pos !== -1) {
            clientes.splice(pos, 1);
        }

        console.log(
            "Cliente desconectado. Ahora son:",
            clientes.length
        );
    });
});


// ============================================================
// ENVIAR AVISO
// ============================================================

function enviar(cliente, aviso) {

    // Una conexion abierta tampoco puede recibir avisos con el token caducado.
    if (cliente.tipo === "gestor" && cliente.expira <= Date.now()) {
        cliente.tipo = null;
        cliente.connection.close(1008, "El token ha expirado");
        return;
    }

    if (
        cliente.connection &&
        cliente.connection.connected
    ) {

        cliente.connection.sendUTF(
            JSON.stringify({
                operacion: "aviso",
                aviso: aviso
            })
        );
    }
}


// ============================================================
// BUSCAR INFORMACION DE UN RECURSO
// ============================================================

function datosRecurso(idRecurso, callback) {

    var sql =
        "SELECT " +
        "r.id AS recurso_id, " +
        "r.modelo AS recurso_modelo, " +
        "r.ubicacion AS recurso_ubicacion, " +
        "r.numero_serie, " +
        "r.estado, " +
        "m.id AS modelo_id, " +
        "m.nombre AS modelo_nombre, " +
        "m.categoria AS modelo_categoria, " +
        "c.id AS categoria_id, " +
        "c.nombre AS categoria_nombre " +
        "FROM recursos r " +
        "LEFT JOIN modelos m ON r.modelo = m.id " +
        "LEFT JOIN categorias c ON m.categoria = c.id " +
        "WHERE r.id = ?";

    conexionBD.query(sql, [idRecurso], function (error, resultados) {

        if (error) {
            console.error("Error buscando recurso:", error);
            return callback(null);
        }

        if (resultados.length === 0) {
            return callback(null);
        }

        var fila = resultados[0];

        var recurso = {
            id: fila.recurso_id,
            modelo: fila.recurso_modelo,
            ubicacion: fila.recurso_ubicacion,
            numero_serie: fila.numero_serie,
            estado: fila.estado
        };

        var modelo = null;

        if (fila.modelo_id != null) {
            modelo = {
                id: fila.modelo_id,
                nombre: fila.modelo_nombre,
                categoria: fila.modelo_categoria
            };
        }

        var categoria = null;

        if (fila.categoria_id != null) {
            categoria = {
                id: fila.categoria_id,
                nombre: fila.categoria_nombre
            };
        }

        callback({
            recurso: recurso,
            modelo: modelo,
            categoria: categoria
        });
    });
}


// ============================================================
// BUSCAR NOMBRE DE SANITARIO
// ============================================================

function nombreSanitario(id, callback) {

    var sql =
        "SELECT nombre, apellidos " +
        "FROM sanitarios " +
        "WHERE id = ?";

    conexionBD.query(sql, [id], function (error, sanitarios) {

        if (error || sanitarios.length === 0) {
            return callback("Sanitario");
        }

        callback(
            sanitarios[0].nombre +
            " " +
            sanitarios[0].apellidos
        );
    });
}


// ============================================================
// BUSCAR NOMBRE DE GESTOR
// ============================================================

function nombreGestor(id, callback) {

    var sql =
        "SELECT nombre, apellidos " +
        "FROM gestores " +
        "WHERE id = ?";

    conexionBD.query(sql, [id], function (error, gestores) {

        if (error || gestores.length === 0) {
            return callback("Gestor");
        }

        callback(
            gestores[0].nombre +
            " " +
            gestores[0].apellidos
        );
    });
}


// ============================================================
// CREAR AVISO
// ============================================================

function crearAviso(origen, texto, color) {

    return {
        fecha: new Date(),
        origen: origen,
        texto: texto,
        color: color
    };
}


// ============================================================
// AVISO AZUL
// NUEVO RECURSO -> TODOS LOS SANITARIOS
// ============================================================

function avisarNuevoRecurso(idGestor, recursoCreado) {

    console.log("AVISO NUEVO RECURSO");
    console.log("Gestor:", idGestor);
    console.log("Recurso:", recursoCreado);


    // Primero buscamos el recurso en MySQL
    datosRecurso(recursoCreado.id, function (info) {

        console.log("INFO RECURSO:", info);

        if (!info) {
            console.log("No se ha encontrado el recurso en MySQL.");
            return;
        }


        var nombreCategoria = "";
        var nombreModelo = "";

        if (info.categoria) {
            nombreCategoria = info.categoria.nombre;
        }

        if (info.modelo) {
            nombreModelo = info.modelo.nombre;
        }


        var texto =
            "SE HA CREADO UN NUEVO RECURSO " +
            nombreCategoria +
            " MODELO " +
            nombreModelo +
            " CON CÓDIGO " +
            info.recurso.numero_serie +
            ".";


        // Buscamos el nombre del gestor en MySQL
        nombreGestor(idGestor, function (origen) {

            var aviso = crearAviso(
                origen,
                texto,
                "azul"
            );

            console.log("Aviso creado:", aviso);


            // Enviar a todos los sanitarios conectados
            clientes.forEach(function (c) {

                console.log(
                    "Cliente conectado:",
                    c.tipo,
                    c.id,
                    c.nombre
                );

                if (c.tipo === "sanitario") {

                    console.log(
                        "ENVIANDO AVISO AL SANITARIO:",
                        c.id
                    );

                    enviar(c, aviso);
                }
            });
        });
    });
}


// ============================================================
// AVISO VERDE
// NUEVA RESEÑA -> TODOS LOS GESTORES
// ============================================================

function avisarNuevaResenya(
    idSanitario,
    idRecurso,
    valoracion
) {

    console.log("AVISO NUEVA RESEÑA");

    datosRecurso(idRecurso, function (info) {

        if (!info) {
            console.log("No se ha encontrado el recurso.");
            return;
        }


        var nombreCategoria = "";
        var nombreModelo = "";

        if (info.categoria) {
            nombreCategoria = info.categoria.nombre;
        }

        if (info.modelo) {
            nombreModelo = info.modelo.nombre;
        }


        var texto =
            "SE HA CREADO UNA RESEÑA PARA EL " +
            nombreCategoria +
            " MODELO " +
            nombreModelo +
            " CON CÓDIGO " +
            info.recurso.numero_serie +
            " Y PUNTUACIÓN " +
            valoracion +
            ".";


        // Buscar nombre del sanitario
        nombreSanitario(idSanitario, function (origen) {

            var aviso = crearAviso(
                origen,
                texto,
                "verde"
            );


            // Enviar a todos los gestores conectados
            clientes.forEach(function (c) {

                if (c.tipo === "gestor") {
                    enviar(c, aviso);
                }
            });
        });
    });
}


// ============================================================
// AVISO ROJO
// INICIO / FIN DE RESERVA
// ============================================================

function avisarAccionReserva(
    idSanitarioOrigen,
    idReserva,
    accion
) {

    console.log("AVISO ACCION RESERVA");
    console.log("Reserva:", idReserva);
    console.log("Accion:", accion);


    // Buscar la reserva en MySQL
    var sqlReserva =
        "SELECT * FROM reservas WHERE id = ?";


    conexionBD.query(
        sqlReserva,
        [idReserva],
        function (error, reservas) {

            if (error) {
                console.error(
                    "Error buscando reserva:",
                    error
                );
                return;
            }

            if (reservas.length === 0) {
                console.log("No existe la reserva.");
                return;
            }


            var reserva = reservas[0];


            // Buscar informacion del recurso
            datosRecurso(
                reserva.recurso,
                function (info) {

                    if (!info) {
                        console.log(
                            "No se ha encontrado el recurso."
                        );
                        return;
                    }


                    var nombreCategoria = "";
                    var nombreModelo = "";

                    if (info.categoria) {
                        nombreCategoria =
                            info.categoria.nombre;
                    }

                    if (info.modelo) {
                        nombreModelo =
                            info.modelo.nombre;
                    }


                    var texto =
                        "SE HA " +
                        accion +
                        " LA RESERVA DEL " +
                        nombreCategoria +
                        " MODELO " +
                        nombreModelo +
                        " CON CÓDIGO " +
                        info.recurso.numero_serie +
                        ".";


                    // Buscar nombre del sanitario
                    nombreSanitario(
                        idSanitarioOrigen,
                        function (origen) {

                            var aviso = crearAviso(
                                origen,
                                texto,
                                "rojo"
                            );


                            // Buscar sanitarios que tienen
                            // una reserva pendiente/no finalizada
                            var sqlDestinatarios =
                                "SELECT DISTINCT sanitario " +
                                "FROM reservas " +
                                "WHERE recurso = ? " +
                                "AND fecha_fin IS NULL " +
                                "AND sanitario != ?";


                            conexionBD.query(
                                sqlDestinatarios,
                                [
                                    reserva.recurso,
                                    idSanitarioOrigen
                                ],
                                function (
                                    error,
                                    destinatarios
                                ) {

                                    if (error) {
                                        console.error(
                                            "Error buscando destinatarios:",
                                            error
                                        );
                                        return;
                                    }


                                    // Convertimos los IDs
                                    // en un array
                                    var idsDestinatarios =
                                        destinatarios.map(
                                            function (r) {
                                                return Number(
                                                    r.sanitario
                                                );
                                            }
                                        );


                                    // Enviar aviso
                                    // solo a esos sanitarios
                                    clientes.forEach(
                                        function (c) {

                                            if (
                                                c.tipo === "sanitario" &&
                                                idsDestinatarios.includes(
                                                    Number(c.id)
                                                )
                                            ) {

                                                enviar(
                                                    c,
                                                    aviso
                                                );
                                            }
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
}


// ============================================================
// EXPORTAR FUNCIONES
// ============================================================

module.exports = {
    avisarNuevoRecurso,
    avisarAccionReserva,
    avisarNuevaResenya
};
