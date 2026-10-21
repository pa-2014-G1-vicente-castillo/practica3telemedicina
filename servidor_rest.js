var express= require("express");
var jwt= require("jwt-simple");//anyadido prcatica 3
var clave= "miSecretoMasOscuro";//anyadido prcatica 3

var app= express();
var avisos = require("./servidor_socket");
const conexion = require("./conexion_mysql.js");//modifico esta linea


/*
var sanitarios=datosServidor.sanitarios
var gestores=datosServidor.gestores
var ubicaciones=datosServidor.ubicaciones
var categorias=datosServidor.categorias
var modelos=datosServidor.modelos
var recursos= datosServidor.recursos
var reservas= datosServidor.reservas
var resenyas=datosServidor.resenyas
console.log(datosServidor);
**/



app.use("/appCliente", express.static("cliente_rest"));
app.use("/appSanitario", express.static("cliente_rpc"));
app.use(express.json());

app.use("/api", function(req, res, next) {

    // Permitir iniciar sesión y registrarse sin token
    if (req.method=== "POST" &&
        (req.path=== "/gestores/login" || req.path === "/gestores")) {
        return next();//da paso a la siguiente fucnion express
    }

    var auth= req.headers.authorization;

    // si no hya cabecera o no empieza por Baerer, rechazo la peticion
    if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json("Token no proporcionado");
    }

    try {
        var datos = jwt.decode(auth.substring(7), clave);

        // Compruebo que el token tenga los campos necesarios.
        if (!datos || !datos.id || !datos.expira) {
            return res.status(401).json("El formato del token no es adecuado");
        }

        // Compruebo si ya ha pasado su fecha de caducidad.
        if (datos.expira < Date.now()) {
            return res.status(401).json("El token ha expirado");
        }

        // Guardo el identificador y permito continuar.
        req.gestorId = datos.id;
        next();

    } catch (error) {
        return res.status(401).json("Token inválido");
    }
});

//--------------------------------GET------------------------------------------------
app.get("/api/modelos", function (req, res){
    var sql= "SELECT * FROM modelos";

    conexion.query(sql, function(err, modelos){
        if (err){
            console.log ("Error al realizar la select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.status(200).json(modelos);
    }); 
});

app.get("/api/categorias", function(req,res){
    var sql = "SELECT * FROM categorias";

    conexion.query(sql, function(err, categorias){

        if (err){
            console.log ("Error al realizar la select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.status(200).json(categorias);
     });
})

app.get("/api/ubicaciones", function (req, res) {
    var sql= "SELECT * FROM ubicaciones";

    conexion.query(sql, function (err,ubicaciones){
        if (err){
            console.log("Error al realizar la select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.status(200).json(ubicaciones);
    });
});

//------------------POST-------------------------------------------------------
app.post("/api/gestores/login", function(req, res){
    const login= req.body.login; //contiene lo que escribe el usuario
    const password= req.body.password;

    //buscar gestor
    var sql= "SELECT * FROM gestores WHERE usuario =? AND password = ?";

    // ANTES ERA ASI->const gestor= gestores.find(g=>g.usuario===login && g.password===password);
    // Los signos de interrogacion ? son huecos que rellena el cliente.

    conexion.query (sql, [login,password], function (err,gestores){
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (gestores.length===1){

            //crea y firma el token usando la clave del sevidor
            // Datos que guardo dentro del token.
            var contenido = {
                id: gestores[0].id,
                expira: Date.now() + 60 * 60 * 1000 // Caduca dentro de una hora.
            };

            var token = jwt.encode(contenido, clave);

            res.status(200).json({id: gestores[0].id, token: token});
            //cuando el gestor inicie sesion, el servidor devolvera tanto su ID como el token JWT
        }
        else{
            res.status(403).json("Credenciales incorrectas");
        }
    });
});

//------------------CREAR NUEVO GESTOR---------------------
app.post("/api/gestores", function (req, res){
    
    //primero compruebo si existe el usuario
    var sql= "SELECT * FROM gestores WHERE usuario= ?";

    conexion.query(sql,[req.body.usuario], function(err, gestores){
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }

        if (gestores.length>0){// si encuentra uno o mas gestores, el usuario ya existe
            return res.status(403).json("El usuario ya existe");
        }
        //La parte de crear un nuevo id la quito porque mi
        //mysql ya lo hace automaticamente

        //Si no existe, lo creo
        var sqlInsert= "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?,?,?,?)";

        var datos =[
            req.body.nombre,
            req.body.apellidos,
            req.body.usuario,
            req.body.password
        ]

        conexion.query(sqlInsert, datos, function(err, resultado){
            if (err){
                console.log("Error al realizar la insercion.");
                return res.status(500).json("Error al realizar la inserccion");
            }
            res.status(201).json("Gestor creado");//respuesta
        });
        //No necesito siguienteGestor, nuevoGestor ni gestores.push(), porque ahora eso lo gestiona MySQL.
    });
});

//devolver datos de GESTOR
app.get("/api/gestores/:id", function(req,res){
    var id=parseInt(req.params.id); // datos de la url

    var sql= "SELECT * FROM gestores WHERE id=?";

    conexion.query(sql,[id],function(err,gestores){ // el [id] rellena el signo el ? de arriba
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        
        //¿existe un gestor?
        if (gestores.length=== 0){//si se cumple esto es que no hay
            return res.status(404).json("No existe ese id");
        }

        //si existen, devuelvo sus datos
        var gestor=gestores[0];
        //preparo lo que voy a devolver
        var devuelvedatos={//en un get no se debe usar req.body
            id: gestor.id,
            nombre: gestor.nombre,
            apellidos: gestor.apellidos,
            usuario: gestor.usuario,
        };
        res.status(200).json(devuelvedatos);
    });
});



//devolver los datos de los SANITARIOS
app.get("/api/sanitarios/:id", function(req,res){
    var id=parseInt(req.params.id); // datos de la url

    var sql="SELECT * FROM sanitarios WHERE id= ?";

    conexion.query(sql, [id], function(err, sanitarios){
        if (err){
            console.log("Error al realizar la consulta",err);
            return res.status(500).json("Error al realizar la consulta");
        }

        //¿existe un sanitario?
        if (sanitarios.length===0){
            return res.status(404).json("No existe ese id");
        }

        //si existe, devuelvo la info
        var sanitario=sanitarios[0];
        var devuelvesanitario={
            id:sanitario.id,
            nombre: sanitario.nombre,
            apellidos: sanitario.apellidos,
            usuario: sanitario.usuario
        };
        res.status(200).json(devuelvesanitario);
    });
});


//Actualizar datos del gestor
app.put("/api/gestores/:id", function(req, res){
    var id= parseInt(req.params.id);
    var sql= "SELECT * FROM gestores WHERE id=?";

    conexion.query(sql,[id],function(err,gestores){
        if (err){
            console.log("Error al realizar la consulta",err);
            return res.status(500).json("Error al realizar la consulta");
        }

        //1) existe el getsor?
        if (gestores.length===0){
            return res.status(404).json("No exixste ese id");
        }

        //2)comprobar usuario unico 
        if (req.body.usuario!== undefined){
            var sqlrepetido= "SELECT * FROM gestores WHERE usuario= ? AND id!= ?";
            conexion.query(sqlrepetido,[req.body.usuario,id],function(err,gestores){
                if (err){
                    console.log("Error al realizar la consulta",err);
                    return res.status(500).json("Error al realizar la consulta");
                }
                if (gestores.length>0){
                    return res.status(403).json("El usuario ya existe");
                }
                actualizarGestor();
            });
        } else{
            actualizarGestor();
        }

        //3)Actualizar los datos 
        function actualizarGestor(){
            var sqlUpdate= "UPDATE gestores SET";
            var datos=[];// guardamos los valores que van a sustituir a ?
            var campos=[];// los campos que queremos modificar

            if (req.body.nombre!==undefined){
                campos.push("nombre=?");
                datos.push(req.body.nombre);
            }
            if (req.body.apellidos !== undefined){
                campos.push("apellidos = ?");
                datos.push(req.body.apellidos);
            }

            if (req.body.usuario !== undefined){
                campos.push("usuario = ?");
                datos.push(req.body.usuario);
            }

            if (req.body.password !== undefined){
                campos.push("password = ?");
                datos.push(req.body.password);
            }

            //Si no se ha enviado ningun dato para actualizar 
            if (campos.length===0){
                return res.status(400).json("No hay datos para actualizar");
            }

            sqlUpdate += campos.join(", "); // esto hace que se una: UPDATE gestores SET nombre = ?, apellidos = ?.....
            sqlUpdate += " WHERE id = ?";

            datos.push(id);
            conexion.query(sqlUpdate, datos, function(err, resultado){
                if (err){
                    console.log("Error al realizar la actualización", err);
                    return res.status(500).json("Error al realizar la actualización");
                }
                res.status(200).json("Gestor actualizado");
            });
        }
    });
});


//-------------------------------RECURSOS------------------------------------

//Obtener recursos (opcinalmente filtrado por criterios)
app.get("/api/recursos", function(req,res){
    var sql ="SELECT * FROM recursos";
    var condiciones=[];
    var valores=[];
    
    //filtrado por modelo
    if (req.query.modelo!==undefined){
        condiciones.push("modelo=?");
        valores.push(parseInt(req.query.modelo));
    }

    //filtrado por ubicacion
    if(req.query.ubicacion!==undefined){
        condiciones.push("ubicacion=?");
        valores.push(parseInt(req.query.ubicacion));
    }

    //filtrado por estado
    if (req.query.estado!==undefined){
        condiciones.push("estado=?");
        valores.push(parseInt(req.query.estado));
    }

    //filtrado por categoria
    if(req.query.categoria!==undefined){
        condiciones.push("modelo IN(SELECT id FROM modelos WHERE categoria=?)");
        //lo que me sta diciendo es: dame los recursos cuyo modelo este entre los modelos que pertenecen a esta categoria
        // modelo IN en este caso me devuelve los recursos de esos modelos.
        valores.push(parseInt(req.query.categoria));
    }

    //Si hay condiciones, añadimos WHERE
    if (condiciones.length>0){
        sql= sql + " WHERE " + condiciones.join(" AND ");
        //ejemplo con el IN: SELECT * FROM recursos WHERE modelo IN (4,5);
    }

    conexion.query(sql,valores,function(err,recursos){
        if (err){
            console.log("Error al realizar la consulta", err);
            res.status(500).json({
                error: "Error al obtener los recursos"
            });
            return;
        }
        res.status(200).json(recursos);
    });
});

//obtener los datos de un recurso
app.get("/api/recursos/:id", function(req,res){
    var id=parseInt(req.params.id); // lee la id
    var sql="SELECT * FROM recursos WHERE id=?";

    conexion.query(sql,[id],function(err,recursos){
        if (err){
            console.log("Error al realizar la consulta",err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (recursos.length===0){
            return res.status(404).json("No existe ese id");
        }

        //si existe, devuelvo datos
        var recurso=recursos[0];
        var devuelverecurso={
            id:recurso.id,
            modelo:recurso.modelo,
            ubicacion:recurso.ubicacion,    
            numero_serie:recurso.numero_serie,
            estado:recurso.estado
        };
        res.status(200).json(devuelverecurso);

    });
});


//Crear nuevo recurso
app.post("/api/recursos", function(req, res){
    //no genero un nuevo id porque ya lo hace sql
    //comprobar que existe el modelo
    var idModelo=parseInt(req.body.modelo);
    var sql= "SELECT * FROM modelos WHERE id= ?";

    conexion.query(sql,[idModelo], function(err,modelos){
        if (err){
            console.log("Error al realizar la consulta",err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (modelos.length===0){
            return res.status(404).json("Modelo no existe");
        }

        //Comprobar que existe la ubicacion
        var idUbicacion = parseInt(req.body.ubicacion);
        var sql = "SELECT * FROM ubicaciones WHERE id=?";

        conexion.query(sql, [idUbicacion], function(err, ubicaciones){
            if (err){
                console.log("Error al realizar la consulta", err);
                return res.status(500).json("Error al realizar la consulta");
            }
            if (ubicaciones.length === 0){
                return res.status(404).json("Ubicacion no existe");
            }

            //Crear el nuevo recurso
            var nuevoRecurso={
                modelo: idModelo,
                ubicacion: idUbicacion,
                numero_serie: req.body.numero_serie,
                estado: parseInt(req.body.estado)
            };

            //Insertar en la base de datos
            var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
            var valores = [
                nuevoRecurso.modelo,
                nuevoRecurso.ubicacion,
                nuevoRecurso.numero_serie,
                nuevoRecurso.estado
            ];

            conexion.query(sql, valores, function(err, resultado){
                if (err){
                    console.log("Error al insertar el recurso", err);
                    return res.status(500).json("Error al insertar el recurso");
                }

                //MySQL nos da el id que acaba de crear
                nuevoRecurso.id = resultado.insertId;
                avisos.avisarNuevoRecurso(req.body.idGestor, nuevoRecurso);
                res.status(201).json(nuevoRecurso);
            });
        });
    });
});


//actualizar recurso
app.put("/api/recursos/:id", function(req, res){
    var id = parseInt(req.params.id);
    //1) comprobar que existe el recurso
    var sql = "SELECT * FROM recursos WHERE id=?";
    conexion.query(sql, [id], function(err, recursos){
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (recursos.length === 0){
            return res.status(404).json("No existe ese id");
        }

        //2) comprobar que el modelo existe
        if (req.body.modelo !== undefined){
            var sqlModelo = "SELECT * FROM modelos WHERE id=?";
            conexion.query(sqlModelo, [parseInt(req.body.modelo)], function(err, modelos){
                if (err){
                    console.log("Error al realizar la consulta", err);
                    return res.status(500).json("Error al realizar la consulta");
                }
                if (modelos.length === 0){
                    return res.status(404).json("Modelo no existe");
                }
                //Si el modelo existe, seguimos comprobando la ubicación
                comprobarUbicacion();
            });
        } else {
            //Si no se cambia el modelo, comprobamos directamente la ubicación
            comprobarUbicacion();
        }

        //3) comprobar que la ubicación existe
        function comprobarUbicacion(){
            if (req.body.ubicacion !== undefined){
                var sqlUbicacion = "SELECT * FROM ubicaciones WHERE id=?";
                conexion.query(sqlUbicacion, [parseInt(req.body.ubicacion)], function(err, ubicaciones){
                    if (err){
                        console.log("Error al realizar la consulta", err);
                        return res.status(500).json("Error al realizar la consulta");
                    }
                    if (ubicaciones.length === 0){
                        return res.status(404).json("Ubicación no existe");
                    }
                    //Si la ubicación existe, actualizamos
                    actualizarRecurso();
                });
            } else {
                //Si no se cambia la ubicación, actualizamos directamente
                actualizarRecurso();
            }
        }

        //4) actualizar recurso
        function actualizarRecurso(){
            var sqlUpdate = "UPDATE recursos SET";
            var datos = [];   // valores que sustituyen a ?
            var campos = [];  // campos que queremos modificar

            if (req.body.modelo !== undefined){
                campos.push("modelo=?");
                datos.push(parseInt(req.body.modelo));
            }
            if (req.body.ubicacion !== undefined){
                campos.push("ubicacion=?");
                datos.push(parseInt(req.body.ubicacion));
            }
            if (req.body.numero_serie !== undefined){
                campos.push("numero_serie=?");
                datos.push(req.body.numero_serie);
            }
            if (req.body.estado !== undefined){
                campos.push("estado=?");
                datos.push(parseInt(req.body.estado));
            }

            //Si no se ha enviado ningún dato para actualizar
            if (campos.length === 0){
                return res.status(400).json("No hay datos para actualizar");
            }

            sqlUpdate += " " + campos.join(", ");
            sqlUpdate += " WHERE id=?";

            datos.push(id);
            conexion.query(sqlUpdate, datos, function(err, resultado){
                if (err){
                    console.log("Error al realizar la actualización", err);
                    return res.status(500).json("Error al realizar la actualización");
                }
                res.status(200).json("Recurso actualizado");
            });
        }
    });
});

//borrar recurso
app.delete("/api/recursos/:id", function (req,res){
    var id=parseInt(req.params.id);

    //1)comprobar que existe el recurso
    var sql="SELECT * FROM recursos WHERE id=?";
    conexion.query(sql,[id],function(err,recursos){
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (recursos.length === 0){
            return res.status(404).json("No existe ese id");
        }

        //2)borrar el recurso
        var sqlDelete="DELETE FROM recursos WHERE id=?";
        conexion.query(sqlDelete,[id], function(err, resultado){
            if (err){
                console.log("Error al borrar el recurso", err);
                return res.status(500).json("Error al borrar el recurso");
            }
            return res.status(204).send();
        });
    });
});

//obtener las reservas de un recurso
app.get("/api/recursos/:id/reservas", function(req,res){
    var id = parseInt(req.params.id);

    //1) comprobar que existe el recurso
    var sql = "SELECT * FROM recursos WHERE id=?";
    conexion.query(sql, [id], function(err, recursos){
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (recursos.length === 0){
            return res.status(404).json("No existe ese id");
        }

        //2) obtener las reservas del recurso
        var sqlReservas = `
            SELECT reservas.id,
            reservas.recurso,
            reservas.sanitario,
            CONCAT(sanitarios.nombre, ' ', sanitarios.apellidos) AS nombre_sanitario,
                reservas.horas_estimadas,
                reservas.fecha_peticion,
                reservas.fecha_inicio,
               reservas.fecha_fin
            FROM reservas
            LEFT JOIN sanitarios ON reservas.sanitario = sanitarios.id
            WHERE reservas.recurso=?
        `;
        conexion.query(sqlReservas, [id], function(err, reservas){
            if (err){
                console.log("Error al realizar la consulta", err);
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json(reservas);
        });
    });
});

//obtener las reseñas de un recurso

app.get("/api/recursos/:id/resenyas", function(req,res){
    var id = parseInt(req.params.id);

    //1) comprobar que existe el recurso
    var sql = "SELECT * FROM recursos WHERE id=?";
    conexion.query(sql, [id], function(err, recursos){
        if (err){
            console.log("Error al realizar la consulta", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if (recursos.length === 0){
            return res.status(404).json("No existe ese id");
        }

        //2) obtener las reseñas del recurso
        var sqlResenyas = `
            SELECT resenyas.id,
                   resenyas.recurso,
                   resenyas.sanitario,
                   CONCAT(sanitarios.nombre, ' ', sanitarios.apellidos) AS nombre_sanitario,
                   resenyas.fecha,
                   resenyas.valor,
                   resenyas.descripcion
            FROM resenyas
            LEFT JOIN sanitarios ON resenyas.sanitario = sanitarios.id
            WHERE resenyas.recurso=?
        `;

        conexion.query(sqlResenyas, [id], function(err, resenyas){
            if (err){
                console.log("Error al realizar la consulta", err);
                return res.status(500).json("Error al realizar la consulta");
            }
            return res.status(200).json(resenyas);
        });
    });
});




app.listen(3000, function() {
    console.log("Servidor arrancado en http://localhost:3000");
});
