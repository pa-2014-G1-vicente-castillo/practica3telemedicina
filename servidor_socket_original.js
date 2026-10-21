// Servidor WebSocket para el sistema de avisos (Parte 3)
var http=require("http");
var httpServer = http.createServer();

//crar serviddor WS
var WebSocketServer=require("websocket").server;
var wsServer = new WebSocketServer({
    httpServer: httpServer 
});

//Iniciar el servidor HTTP en un puerto
var puertoWS=4444;
httpServer.listen(puertoWS, function () {
    console.log("Servidor WebSocket iniciado en puerto:", puertoWS);
});

//cargar la base de datos
var datos= require("./datos.js");
var sanitarios= datos.sanitarios;
var gestores= datos.gestores;
var categorias= datos.categorias;
var modelos= datos.modelos;
var recursos= datos.recursos;
var reservas= datos.reservas;

var clientes = []; // array de los clientes que se conectan {connection, tipo, id, nombre}

wsServer.on("request", function (request) {// este callback se ejecuta cuando llega una nueva conexion de un cliente
    var connection = request.accept("avisos", request.origin); //acepta la conexion ('avisos es el protocolo que está usando, tiene que coinicidir con el cliente')

    var cliente = { //creo un objeto para guardar los datos del cliente conectado, al principio no sabemos si es gestor o sanitario por eso es null
        connection: connection, 
        tipo: null, //sanitario o gestor
        id: null, 
        nombre: null }; 
    clientes.push(cliente);//lo añado a la lista de clientes conectados
    console.log("Cliente WS conectado. Ahora son:", clientes.length); 

    connection.on("message", function (message){//cuando el cliente manda un mensaje
        if (message.type !== "utf8") 
            return;//solo aacepta mensajes de texto
        
        var msg=JSON.parse(message.utf8Data);//pasa de texto a objeto JavaScript

        if (msg.operacion==="identificar") {
            cliente.tipo = msg.tipo;       // "sanitario" o "gestor"
            cliente.id = Number(msg.id);   // id interno, solo para filtrar destinatarios
            cliente.nombre = msg.nombre;   // nombre mostrado como origen
            console.log("Se ha identificado:", cliente.tipo, cliente.id, cliente.nombre);
        }
    });

    connection.on("close", function () {//cuando el cliente se desconecta
        var pos=clientes.indexOf(cliente);//busca la posicion dentro del array clientes
        if (pos!==-1) 
            clientes.splice(pos, 1);//si lo encuentra lo elimina del array, asi se deja de considerar conectado
        console.log("Cliente desconectado. Ahora son:", clientes.length);
    });
});

//manda avisos a un cliente concreto
function enviar(cliente, aviso) {
    if (cliente.connection && cliente.connection.connected){//comprueba que el cliente tiene conexión y sigue conectado
        cliente.connection.sendUTF(JSON.stringify({ 
            operacion:"aviso", 
            aviso:aviso 
        }));
    }
}

//busca la info necesaria de un recurso
function datosRecurso(idRecurso) {
    var recurso=recursos.find(r=>r.id===Number(idRecurso));

    if (!recurso) 
        return null; //si no existe devuelve null

    var modelo=modelos.find(m=>m.id===recurso.modelo);//busca modelo de ese recurso
    var categoria= null;
    
    if (modelo){
        categoria=categorias.find(c=>c.id===modelo.categoria);//busca la categoria del modelo
    }
    return {recurso, modelo, categoria };
}

function nombreSanitario(id) {//busca nombre del sanitario
    var sanitario=sanitarios.find(s=>s.id ===Number(id));

    if (sanitario){
        return sanitario.nombre + " " +sanitario.apellidos;
    }
    return "Sanitario";
}

function nombreGestor(id) {
    var gestor=gestores.find(g=>g.id===Number(id));

    if(gestor){
        return gestor.nombre + " " + gestor.apellidos;
    }
    return "Gestor";
}

function crearAviso(origen, texto, color) {
    return {
        fecha:new Date(),//momento en el que se crea
        origen:origen,
        texto:texto,
        color: color
    };
}

// Aviso AZUL: nuevo recurso creado por gestor -> a todos los sanitarios conectados
function avisarNuevoRecurso(idGestor, recursoCreado) {

    console.log("AVISO NUEVO RECURSO");
    console.log("Gestor:", idGestor);
    console.log("Recurso:", recursoCreado);

    //obtengo la info del recurso
    var info=datosRecurso(recursoCreado.id);
    console.log("INFO RECURSO:", info);
    
    //si no existe el recurso, termina
    if (!info){
        return;
    } 

    //var que guardan nombres
    var nombreCategoria="";
    var nombreModelo="";

    if (info.categoria){
        nombreCategoria=info.categoria.nombre;
    }

    if (info.modelo){
        nombreModelo=info.modelo.nombre;
    }

    //construyo el texto de aviso
    var texto = "SE HA CREADO UN NUEVO RECURSO " +nombreCategoria + " MODELO " + nombreModelo + " CON CÓDIGO " + info.recurso.numero_serie + ".";

    //crea el aviso
    var aviso=crearAviso(nombreGestor(idGestor), texto, "azul");

    //Envia el aviso a todos los sanitarios
    clientes.forEach(function(c){//recorre todos los sanitarios
        console.log("Cliente conectado:", c.tipo, c.id);
        if (c.tipo==="sanitario"){
            enviar(c,aviso);
        }
    });
}

// Aviso VERDE: nueva reseña por sanitario -> a todos los gestores conectados
function avisarNuevaResenya(idSanitario, idRecurso, valoracion) {
    var info=datosRecurso(idRecurso);
    if (!info){
        return;
    }

     // Variables para guardar nombres
    var nombreCategoria= "";
    var nombreModelo= "";

    if (info.categoria) {
        nombreCategoria=info.categoria.nombre;
    }
    
    if (info.modelo) {
        nombreModelo=info.modelo.nombre;
    }
    var texto= "SE HA CREADO UNA RESEÑA PARA EL " +
        nombreCategoria +
        " MODELO " +
        nombreModelo +
        " CON CÓDIGO " +
        info.recurso.numero_serie +
        " Y PUNTUACIÓN " +
        valoracion + ".";
    
    //crear el aviso
    var aviso=crearAviso(nombreSanitario(idSanitario), texto,"verde");

    clientes.forEach(function(c){
        if (c.tipo==="gestor"){
            enviar(c,aviso);
        }
    });
}

// Aviso ROJO: inicio/fin de reserva -> a sanitarios conectados con reserva no finalizada de ese recurso
function avisarAccionReserva(idSanitarioOrigen, idReserva, accion) {
    var reserva = reservas.find(r => r.id === Number(idReserva));
    if (!reserva){
        return;
    } 

    var info = datosRecurso(reserva.recurso);
    if (!info){
        return;
    } 

    var nombreCategoria="";
    var nombreModelo="";

    if (info.categoria){
        nombreCategoria=info.categoria.nombre;
    }
    
    if (info.modelo){
        nombreModelo=info.modelo.nombre;
    }

    var texto = "SE HA " + accion + " LA RESERVA DEL " + nombreCategoria
    + " MODELO " +
    nombreModelo+
    " CON CÓDIGO " +
    info.recurso.numero_serie + ".";

    var aviso = crearAviso(nombreSanitario(idSanitarioOrigen), texto, "rojo");

    var destinatarios = [];
    for (var i = 0; i < reservas.length; i++) {

        if (reservas[i].recurso === reserva.recurso && reservas[i].fecha_fin == null) {
            destinatarios.push(reservas[i].sanitario);
        }

    }

    clientes.forEach(function (c) {

    if (c.tipo === "sanitario" && destinatarios.includes(c.id) && c.id !== idSanitarioOrigen) {
        enviar(c, aviso);
    }
    });
}


module.exports = {
    avisarNuevoRecurso,
    avisarAccionReserva,
    avisarNuevaResenya
};
