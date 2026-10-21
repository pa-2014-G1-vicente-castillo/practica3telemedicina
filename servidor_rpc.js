var rpc = require("./rpc.js"); // Incorporamos la librería RPC
var avisos = require("./servidor_socket"); //incorporo la funcion aviso
var conexionBD = require("./conexion_mysql.js"); //es la que hemos cambiado

rpc.debug = true;

/*
var sanitarios=datosServidor.sanitarios;
var categorias=datosServidor.categorias;
var modelos=datosServidor.modelos;
var recursos=datosServidor.recursos;
var reservas=datosServidor.reservas;
var resenyas=datosServidor.resenyas;
var ubicaciones=datosServidor.ubicaciones;
**/

function obtenerCategorias(callback){
    var sql="SELECT * FROM categorias";
    conexionBD.query(sql, function(error,categorias){
        if (error){
            callback(null);
        }else{
            callback(categorias);
        }
    });
}

function obtenerModelos(callback) {
    var sql="SELECT * FROM modelos";
    conexionBD.query(sql, function(error,modelos){
        if (error){
            callback(null);
        }else{
            callback(modelos);
        }
    });
}

function obtenerUbicaciones(callback){
    var sql="SELECT * FROM ubicaciones";
    conexionBD.query(sql, function(error,ubicaciones){
        if (error){
            callback(null);
        }else{
            callback(ubicaciones);
        }
    });
}

function loginSanitario(usuario, password, callback){
    var sql= "SELECT * FROM sanitarios WHERE usuario=? AND password=?";
    conexionBD.query(sql,[usuario,password],function(error,sanitarios){
        if (error){
            callback(null);
        }else {
            if (sanitarios.length===0){
                callback(null);
            }else{
                callback(sanitarios[0].id);
            }
        }
    });
}

function crearSanitario(datosSanitario,callback){
    var sql="SELECT * FROM sanitarios WHERE usuario=?";
    conexionBD.query(sql,[datosSanitario.usuario],function(error,sanitarios){
        if ((error) || (sanitarios.length>0)){
            return callback(null); //el return porque ahi termina 
        }

        //insertar en la base de datos
        var sql="INSERT INTO sanitarios (nombre, apellidos, usuario, password) VALUES (?,?,?,?)";
        var valores=[
            datosSanitario.nombre,
            datosSanitario.apellidos,
            datosSanitario.usuario,
            datosSanitario.password
        ]
        conexionBD.query(sql, valores, function(error,resultado){
            // resultado contiene la información que devuelve MySQL
            // después de ejecutar el INSERT.
            // De ahí podemos obtener el ID que acaba de crear.
            if(error){
                return callback(null);
            }
            //MySQL nos da el id que acaba de crear
            return callback(resultado.insertId);
        });
    });
}

function actualizarSanitario(idSanitario, datosSanitario, callback){
    var sql = "SELECT * FROM sanitarios WHERE id=?";
    conexionBD.query(sql, [idSanitario], function(error, sanitarios){
        if((error) || (sanitarios.length===0)){
            return callback(null);
        }

        // Función que realiza la actualización
        function hacerUpdate(){
            var sqlUpdate= "UPDATE sanitarios SET";
            var datos=[];   // guarda los valores que sustituyen a ?
            var campos=[];  // guarda las partes del SQL

            if (datosSanitario.nombre!= undefined){
                campos.push("nombre=?");
                datos.push(datosSanitario.nombre);
            }

            if (datosSanitario.apellidos!= undefined){
                campos.push("apellidos=?");
                datos.push(datosSanitario.apellidos);
            }

            if (datosSanitario.usuario!= undefined){
                campos.push("usuario=?");
                datos.push(datosSanitario.usuario);
            }

            if (datosSanitario.password!= undefined){
                campos.push("password=?");
                datos.push(datosSanitario.password);
            }

            // Si no se ha enviado ningún dato para actualizar
            if (campos.length===0){
                return callback(true);
            }

            sqlUpdate+= " " + campos.join(" , ") + " WHERE id = ?";
            datos.push(idSanitario);
            conexionBD.query(sqlUpdate, datos, function(error){
                if(error){
                    return callback(null);
                }
                return callback(true);
            });
        }

        // Si se quiere cambiar el usuario, primero comprobamos que no esté repetido
        if (datosSanitario.usuario!= undefined){
            var sqlrepetido="SELECT * FROM sanitarios WHERE usuario=? AND id!=?";
            conexionBD.query(sqlrepetido,[datosSanitario.usuario, idSanitario],function(error, sanitarios){
                    if((error) || (sanitarios.length > 0)){
                        return callback(null);
                    }
                    // Una vez comprobado que el usuario no está repetido,
                    // hago la actualización
                    hacerUpdate();
                }
            );
        } else {
            // No se cambia el usuario,
            // así que puedo actualizar directamente
            hacerUpdate();
        }
    });
}

function obtenerSanitario(idSanitario,callback){
    var sql="SELECT * FROM sanitarios WHERE id=?";
    conexionBD.query(sql,[idSanitario],function(error,sanitarios){
        if((error) || (sanitarios.length===0)){
            return callback(null);
        }
        return callback({
            id:idSanitario,
            nombre:sanitarios[0].nombre,
            apellidos:sanitarios[0].apellidos,
            usuario:sanitarios[0].usuario
        });
    });
}

function obtenerRecursos(idModelo, callback){
    var sql="SELECT * FROM recursos WHERE modelo=? AND estado=?";
    conexionBD.query(sql, [idModelo,0],function(error,recursos){
        if ((error)|| (recursos.length===0)){
            return callback(null);
        }
        return callback(recursos);
    });
}

function tiempoPendiente(idRecurso, callback){
    // Busco las reservas de ese recurso
    // que todavía no han terminado
    var sql="SELECT * FROM reservas WHERE recurso=? AND fecha_fin IS NULL";
    conexionBD.query(sql,[idRecurso],function(error,reservas){
        if((error) || (reservas.length===0)){
            return callback(null);
        }

        // 1. Busco la reserva que está en uso ahora mismo
        var reservaUso=reservas.find(r=>r.fecha_inicio!=null);
        var tiempo=0;
        var ahora=new Date();

        // 2. Si hay una reserva en uso,
        // calculo cuánto tiempo le queda
        if(reservaUso){
            var finEstimada=new Date(reservaUso.fecha_inicio);
            finEstimada=new Date(finEstimada.getTime() + reservaUso.horas_estimadas*60*60*1000);

            var milisegundosRestantes=finEstimada-ahora;
            if(milisegundosRestantes>0){
                tiempo+=milisegundosRestantes/(1000*60*60);
            }
        }

        // 3. Busco las reservas pendientes
        // y las ordeno por fecha de petición
        var sqlPendientes=
            "SELECT * FROM reservas " +
            "WHERE recurso=? " +
            "AND fecha_fin IS NULL " +
            "AND fecha_inicio IS NULL " +
            "ORDER BY fecha_peticion ASC";

        conexionBD.query(sqlPendientes,[idRecurso],function(error,reservasPendientes){
            if(error){
                return callback(null);
            }

            // 4. Si NO hay una reserva en uso,
            // la primera pendiente puede coger el recurso directamente.
            // Por eso no contamos sus horas.
            if(reservaUso==null && reservasPendientes.length>0){
                reservasPendientes.shift();
            }

            // 5. Sumamos las horas de las reservas que están detrás
            reservasPendientes.forEach(function(r){
                tiempo+=r.horas_estimadas;
            });

            // 6. Devolvemos el tiempo pendiente
            return callback(tiempo);
        });
    });
}

function obtenerReservas(idSanitario,callback){
    var sql="SELECT * FROM reservas WHERE sanitario=?";
    conexionBD.query(sql,[idSanitario],function(error,reservas){
        if ((error) || (reservas.length===0)){
            return callback(null);
        }
        return callback(reservas);
    });
}

function obtenerResenyas(idRecurso,callback){
    var sql="SELECT * FROM resenyas WHERE recurso=?";
    conexionBD.query(sql,[idRecurso],function(error,resenyas){
        if ((error) || (resenyas.length===0)){
            return callback(null);
        }
        return callback(resenyas);
    });
}

function crearResenya(idRecurso, idSanitario, valoracion, descripcion, callback){
    //compruebo el recurso y el sanitario existen
    var sqlRecurso="SELECT * FROM recursos WHERE id=?";
    var sqlSanitario="SELECT * FROM sanitarios WHERE id=?";

    conexionBD.query(sqlSanitario, [idSanitario], function(error, sanitarios){
        if((error) || (sanitarios.length===0)){
            return callback(null);
        }
        //una vez comprobados lo sanitarios, compruebo la otra condicion 
        conexionBD.query(sqlRecurso, [idRecurso], function(error, recursos){
            if((error) || (recursos.length===0)){
                return callback(null);
            }

            // Aquí ya sé que existen el sanitario y el recurso
            var sql=" INSERT INTO resenyas (recurso, sanitario,fecha,valor,descripcion) VALUES (?,?,?,?,?)";
            var valores=[
                idRecurso,
                idSanitario,
                new Date(),
                valoracion,
                descripcion
            ]
            conexionBD.query(sql,valores,function(error,resultado){
                if (error){
                    return callback(null);
                }
            
                avisos.avisarNuevaResenya(idSanitario, idRecurso, valoracion);
                //MySQL me da el id
                return callback(resultado.insertId);

            });
        });
    });
}

function reservarRecurso(idRecurso, idSanitario, horasEstimadas, callback){
    // Compruebo que existen el sanitario y el recurso
    var sqlSanitario="SELECT * FROM sanitarios WHERE id=?";
    var sqlRecurso="SELECT * FROM recursos WHERE id=?";

    conexionBD.query(sqlSanitario, [idSanitario], function(error, sanitarios){
        if((error) || (sanitarios.length===0)){
            return callback(null);
        }
        //una vez comprobados lo sanitarios, compruebo la otra condicion 
        conexionBD.query(sqlRecurso, [idRecurso], function(error, recursos){
            if((error) || (recursos.length===0)){
                return callback(null);
            }

            // Aquí ya sé que existen el sanitario y el recurso
            var sql="INSERT INTO reservas (recurso, sanitario, horas_estimadas, fecha_peticion, fecha_inicio, fecha_fin) VALUES(?,?,?,?,?,?)";
            var valores=[
                idRecurso,
                idSanitario,
                horasEstimadas,
                new Date(),
                null,
                null
            ]

            conexionBD.query(sql,valores,function(error,resultado){
                if (error){
                    return callback(null);
                }
                //MySQL me da el id
                return callback(resultado.insertId);
            });
        });
    });
}


function cancelarReserva(idReserva,callback){
    var sql="DELETE FROM reservas WHERE id=?";
    conexionBD.query(sql,[idReserva],function(error,reservas){
        if((error) || (reservas.affectedRows===0)){ //el affetedRows se refier a las lineas que ha eliminado
            return callback(null);
        }
        return callback(true);
    });
}

function iniciarReserva(idReserva,callback){

    var sql="SELECT * FROM reservas WHERE id=?";
    conexionBD.query(sql, [idReserva],function(error,reservas){
        if((error) || (reservas.length===0)){
            return callback(null);
        }
        var reserva=reservas[0];
        if (reserva.fecha_inicio==null){

            var sqlUpdate="UPDATE reservas SET fecha_inicio=? WHERE id=?";
            conexionBD.query(sqlUpdate,[new Date(),idReserva],function(error,resultado){
                if((error) || (resultado.affectedRows===0)){
                    return callback(null);
                    // En UPDATE/DELETE usamos affectedRows para saber si se ha 
                    // modificado/eliminado alguna fila
                }
                avisos.avisarAccionReserva(reserva.sanitario, idReserva, "INICIADO");
                return callback(true);
            });
        }else {
            return callback(true);
        }
    });
}

function finalizarReserva(idReserva, callback){
    var sql="SELECT * FROM reservas WHERE id=?";
    conexionBD.query(sql,[idReserva], function(error, reservas){
        if ((error) || (reservas.length===0)){
            return callback(null);
        }

        if(reservas[0].fecha_fin==null){
            
            var sqlUpdate="UPDATE reservas SET fecha_fin=? WHERE id=?";
            conexionBD.query(sqlUpdate,[new Date(),idReserva],function(error,resultado){
                if ((error) || (resultado.affectedRows==0)){
                    return callback(null);
                }
                avisos.avisarAccionReserva(reservas[0].sanitario, idReserva, "FINALIZADO");
                //ojo con cambiar esto eh en avisos.
                return callback(true);
            });
        }else{
            return callback(true);
        }
    });
}

function obtenerRecurso(idRecurso,callback){
    var sql="SELECT * FROM recursos WHERE id=?";
    conexionBD.query(sql,[idRecurso],function(error,recursos){
        if((error) || (recursos.length===0)){
            return callback(null);
        }
        return callback(recursos[0]);
    });
}

var servidor = rpc.server(); // Crear el servidor RPC
var app = servidor.createApp("app_sanitario"); // Crear aplicación de RPC

//Registro de funciones RPC 
app.registerAsync(obtenerCategorias);
app.registerAsync(obtenerModelos);
app.registerAsync(obtenerUbicaciones);
app.registerAsync(loginSanitario);
app.registerAsync(crearSanitario);
app.registerAsync(actualizarSanitario);
app.registerAsync(obtenerSanitario);
app.registerAsync(obtenerReservas);
app.registerAsync(obtenerRecursos);
app.registerAsync(obtenerResenyas);
app.registerAsync(crearResenya);
app.registerAsync(reservarRecurso);
app.registerAsync(cancelarReserva);
app.registerAsync(iniciarReserva);
app.registerAsync(finalizarReserva);
app.registerAsync(obtenerRecurso);
app.registerAsync(tiempoPendiente);


