//----------------WEBSOCKET-----------------
var conexionAvisos = null;

function abrirWebSocketGestor() {
    if (conexionAvisos != null) conexionAvisos.close();
    conexionAvisos=new WebSocket("ws://localhost:4444", "avisos");

    var nombreGestor="Gestor";
    if (gestorActual) {
        nombreGestor=gestorActual.nombre + " " + gestorActual.apellidos;
    }

    conexionAvisos.addEventListener("open", function () {
        conexionAvisos.send(JSON.stringify({
            operacion: "identificar",
            tipo:"gestor",
            token: window.tokenJWT,
            id:gestorId,
            nombre: nombreGestor
        }));
    });

    conexionAvisos.addEventListener("message", function (msg) {
        var datos= JSON.parse(msg.data);//convierte texto en objeto JavaScript
        if (datos.operacion==="aviso") {
            pintarAviso(datos.aviso);
        }
    });
}

function cerrarWebSocketAvisos() {//cierra porque el usuario sale
    if (conexionAvisos!= null) {
        conexionAvisos.close();
        conexionAvisos= null;
    }
}

function pintarAviso(aviso) {
    var tbody= document.getElementById("tbody_avisos");
    
    if (!tbody) {
        return;
    }
    var fila= tbody.insertRow(-1);
    fila.className= "aviso_" + aviso.color;
    fila.insertCell(0).innerHTML= formatearFecha(aviso.fecha);
    fila.insertCell(1).innerHTML= aviso.origen;
    fila.insertCell(2).innerHTML= aviso.texto;
}


//Datos de memoria para poder traducir ids a nombres
var categorias=[];
var modelos=[];
var ubicaciones= [];
var gestorId=null;
var gestorActual= null;
var modoEdicionGestor = false;
var recursoActual=null; 


//Cabiar seccion
function cambiarSeccion(idActiva){
    const ids=["seccion_login", "seccion_registro", "seccion_inicio", "seccion_recurso"];
    ids.forEach(id =>document.getElementById(id).classList.remove("activa"));
    document.getElementById(idActiva).classList.add("activa");

    if (idActiva === "seccion_inicio") {
    cargarRankingReservas();
}
}


// -------------------- CARGA DE LISTAS PARA SELECTS --------------------
// Ubicaciones
function obtenerUbicaciones(callback) {
    rest.get("/api/ubicaciones", function (estado, respuesta) {
        if (estado === 200) {
            ubicaciones = respuesta;
            rellenarSelect("ubicacion", ubicaciones);

            if (callback) callback();
        }else {
            alert("Error al cargar ubicaciones. Código: " + estado);
        }
    });
}

// Categorías
function obtenerCategorias(callback) {
    rest.get("/api/categorias", function (estado, respuesta) {
        if (estado === 200) {
            categorias = respuesta;
            rellenarSelect("categoria", categorias);
            if (callback) callback();
        } else {
            alert("Error al cargar categorías. Código: " + estado);
        }
    });
}

// Modelos
function obtenerModelos(callback) {
    rest.get("/api/modelos", function (estado, respuesta) {
        if (estado === 200) {
            modelos = respuesta;
            rellenarSelect("modelo", modelos);
            if (callback) callback();
        } else {
            alert("Error al cargar modelos. Código: " + estado);
        }
    });
}

// Rellenar un <select> manteniendo "Todos"
function rellenarSelect(idSelect, lista) {
    const select = document.getElementById(idSelect);
    // Deja "Todos" con value=""
    select.innerHTML = `<option value="">Todos</option>`;

    for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        select.innerHTML += "<option value='"+ item.id+"'>"+ item.nombre+"</option>";
    }
}


// Cargar los 3 combos (en cadena)
function cargarCombos(callback) {
    obtenerCategorias(function () {
        obtenerModelos(function () {
            obtenerUbicaciones(function () {
                if (callback) callback();
            });
        });
    });
}

//---------------------LOGIN/REGISTRO---------------

//Login
function hacerLogin() {
    var user= document.getElementById("login").value.trim();
    var pass= document.getElementById("password").value.trim();

    if (!user || !pass){
    alert("Rellenar usuario y contraseña");
    return;
    }

    rest.post("/api/gestores/login", { login: user, password: pass }, function (estado, respuesta) {
    if (estado == 200) {

        //se supone que el servidor devuelve un objeto con los datos: el ID del gestor y su token
        window.tokenJWT = respuesta.token; 


        // respuesta puede venir como "1" (texto) -> lo convierto a número
        gestorId = parseInt(respuesta.id);
        cargarCombos(function () {
            cambiarSeccion("seccion_inicio");
        });
        // tabla vacía al entrar
        document.getElementById("tbody_recursos").innerHTML = "";

      //bienvenida
        rest.get("/api/gestores/"+gestorId, function(estado2, gestor){
            if (estado2==200){
                gestorActual=gestor;

                console.log("Gestor:",gestor.nombre, gestor.apellidos);
                gestorActual=gestor;
                mostrarBienvenida(gestor);
                abrirWebSocketGestor();// se pone depues de obtener los datos del gestor, porque necesita gestAct, gestId, nombre y apellidos
            }else{
                console.log("No se pudo obtener datos del gestor")
            }
        });
    } else {
        console.log("Credenciales incorrectas");
    }
  });
}

//Ir a Registro
function hacerRegistro(){
    document.getElementById("nombre_reg").value="";
    document.getElementById("apellidos_reg").value="";
    document.getElementById("login_reg").value="";
    document.getElementById("password_reg").value="";

    cambiarSeccion("seccion_registro");
}


//Guardar registro
function guardarRegistro(){
    const gestor={
        nombre: document.getElementById("nombre_reg").value,
        apellidos: document.getElementById("apellidos_reg").value,
        usuario:document.getElementById("login_reg").value,
        password:document.getElementById("password_reg").value
    };

    if (!gestor.nombre || !gestor.apellidos || !gestor.usuario || !gestor.password) {
        alert("Rellena todos los campos");
        return;
    }

    //Modo edición
    if (modoEdicionGestor && gestorId!=null){
        rest.put("/api/gestores/" + gestorId, gestor, function(estado, respuesta){
            if (estado===200){
                alert("Datos actualizados");

                //refrescar gestorActual + bienvenida
                rest.get("/api/gestores/"+ gestorId, function (st2, g){
                   if (st2 ===200){
                    gestorActual=g;
                    cambiarSeccion("seccion_inicio");
                    mostrarBienvenida(g);
                    abrirWebSocketGestor(); //actualiza la identeificacion de WB si el gestor cambia su nombre/apellido
                   } 
                });
                modoEdicionGestor=false;
            }else{
                alert("Error al actualizar. Código: "+ estado);
            }
        });
        return;
    }

    //Registro normal
    rest.post("/api/gestores",gestor, function(estado,respuesta){
        if (estado === 201 || estado===200) {
            alert("Registro exitoso. Inicie sesión.");
            cambiarSeccion("seccion_login");
        }else if (estado===403) {
            alert("Este usuario ya existe");
        }else{
            alert("Eroor en el registro. Código: "+estado)
        }
    });
}

//Cancelar Registro
function cancelarRegistro(){
    if(modoEdicionGestor){
        modoEdicionGestor=false;
        cambiarSeccion("seccion_inicio");
    }else{
        cambiarSeccion("seccion_login");
    }
}


//-----------------PÁGINA DE INICIO/BUSQUEDA DE RECURSOS Y TABLA--------------

//Mostrar bienvenido 
function mostrarBienvenida(gestor){
    const h2= document.getElementById("bienvenida");
    h2.innerHTML = "Bienvenido, " + gestor.nombre+" "+gestor.apellidos;
}
//Editar Datos
function editarDatos(){
    if (!gestorActual) return;

    modoEdicionGestor=true;

    document.getElementById("nombre_reg").value=gestorActual.nombre;
    document.getElementById("apellidos_reg").value=gestorActual.apellidos;
    document.getElementById("login_reg").value=gestorActual.usuario;
    document.getElementById("password_reg").value=gestorActual.password;

    cambiarSeccion("seccion_registro");
}


//Para salir
function salir(){
    cerrarWebSocketAvisos();//al cerrar el gestor deja de recibir avisos
    window.tokenJWT = null;//borro el token guardado

    gestorId = null;

    document.getElementById("login").value= "";
    document.getElementById("password").value= "";
    document.getElementById("bienvenida").innerHTML= "";
    document.getElementById("tbody_recursos").innerHTML= "";

    //Reseteo los filtros 
    document.getElementById("categoria").value= "";
    document.getElementById("modelo").value= "";
    document.getElementById("ubicacion").value= "";
    document.getElementById("estado").value= "";

    //Reseteo variables globales
    gestorActual=null;
    modoEdicionGestor=false;
    recursoActual=null;

    cambiarSeccion("seccion_login");
}

function buscarRecurso(){
    const categoria = document.getElementById("categoria").value;
    const modelo = document.getElementById("modelo").value;
    const ubicacion = document.getElementById("ubicacion").value;
    const estado = document.getElementById("estado").value;

    //contruyo los parametros 
    const parametros=[];
    if (categoria) parametros.push("categoria="+categoria);
    if (modelo) parametros.push("modelo="+modelo);
    if (ubicacion) parametros.push("ubicacion="+ubicacion);
    if (estado) parametros.push("estado="+estado);

    const url="/api/recursos"+(parametros.length ? "?" + parametros.join("&"):"");

    rest.get(url, function(est, respuesta){
        if (est===200){
            console.log("recursos recibidos:", respuesta);
            tablaRecursos(respuesta);
        }else{
            alert("Error al bucar recursos. Código: "+est);
        }
    })
}

//Hacer la tabla de tdoby_recursos
function tablaRecursos(recursos){
    var tbody=document.getElementById("tbody_recursos");

    tbody.innerHTML=""; //limpio antes
    for (let i=0; i<recursos.length;i++){
        let r=recursos[i];


        //Creo el boton de abrir
        const abrir =document.createElement("button");
        abrir.innerHTML="Abrir";
        abrir.onclick=function(){
            abrirRecurso(r.id);
        }

        // Guardamos el id correcto del recurso en el botón
        const eliminar = document.createElement("button");
        eliminar.innerHTML = "Eliminar";
        eliminar.onclick = function() {
                borrarRecurso(r.id);
            };
    
        //convertir id a nombres
        var categoria= nombreCategoriaPorModelo(r.modelo);
        var modelo=nombreModelo(r.modelo);
        var ubicacion = nombreUbicacion(r.ubicacion);
        var estado = textoEstado(r.estado);

        var datos=[r.numero_serie,categoria,modelo,ubicacion,estado];

        var fila=tbody.insertRow(-1);
        //poner las celdas normales
        
        for (var j = 0; j < datos.length; j++) {
            var celda = fila.insertCell(j);
            celda.innerHTML = datos[j];
        }

        // Crear UNA sola celda para acciones
        var celdaAcciones = fila.insertCell(-1);

        // Meter los dos botones en la misma celda
        celdaAcciones.appendChild(abrir);
        celdaAcciones.appendChild(eliminar);
        }
    }

function borrarRecurso(id) {
  if (!confirm("¿Seguro que quieres borrar este recurso?")) return;
    rest.delete("/api/recursos/" + id, function (estado, respuesta) {
        if (estado === 204 || estado === 200) {
            // refrescar tabla con la búsqueda actual
            buscarRecurso();
        } else if (estado === 404) {
            alert("No existe ese recurso.");
            buscarRecurso();
        } else {
            alert("Error al borrar. Código: " + estado);
        }
    });
}

function nombreModelo(idModelo) {
    idModelo = parseInt(idModelo);//por si viene como texto
    for (let i = 0; i < modelos.length; i++) {
        if (modelos[i].id === idModelo) {
            return modelos[i].nombre;
        }
    }
    return "";
}

function nombreCategoriaPorModelo(idModelo) {
    idModelo = parseInt(idModelo);//por si viene como texto
    // 1) buscar el modelo
    let categoriaId = null;

    for (let i = 0; i < modelos.length; i++) {
        if (modelos[i].id === idModelo) {
            categoriaId = modelos[i].categoria;
            break;
        }
    }
    if (categoriaId === null) {
        return "";
    }

    // 2) buscar la categoria de ese modelo
    for (let j = 0; j < categorias.length; j++) {
        if (categorias[j].id === categoriaId) {
            return categorias[j].nombre;
        }
    }
    return "";
}

function nombreUbicacion(idUbicacion) {
    idUbicacion = parseInt(idUbicacion);
    for (let i = 0; i < ubicaciones.length; i++) {
        if (ubicaciones[i].id === idUbicacion) {
            return ubicaciones[i].nombre;
        }
    }
    return "";
}

function textoEstado(estado) {
    estado = parseInt(estado);
    if (estado === 0) {
        return "Operativo";
    } else if (estado === 1) {
        return "De baja/defectuoso";
    } else if (estado === 2) {
        return "En mantenimiento";
    } else {
        return "";
    }
}

//--------------PARA LA FICHA CON INFROMACION DEL RECURSO-----
function volverAListado(){
    cambiarSeccion("seccion_inicio");
}

function anyadirRecurso() {
    recursoActual = null; //nuevo recurso

    //contruyo los selects de la ficha
    rellenarSelect("recurso_categoria", categorias);
    rellenarSelect("recurso_modelo", modelos);
    rellenarSelect("recurso_ubicacion", ubicaciones);

    document.getElementById("recurso_categoria").onchange = filtrarModelosFicha;

    //pongo valores por defecto
    document.getElementById("recurso_categoria").value = "";
    document.getElementById("recurso_modelo").value = "";
    document.getElementById("recurso_ubicacion").value = "";
    document.getElementById("recurso_num_serie").value = "";
    document.getElementById("recurso_estado").value = "0";

    //vacio las tablas de reservas y reseñas
    document.getElementById("tbody_reservas").innerHTML = "";
    document.getElementById("tbody_resenyas").innerHTML = "";

    cambiarSeccion("seccion_recurso");
}

function guardarRecurso() {
    const modelo= document.getElementById("recurso_modelo").value;
    const ubicacion= document.getElementById("recurso_ubicacion").value;
    const numeroSerie= document.getElementById("recurso_num_serie").value.trim();
    const estado= document.getElementById("recurso_estado").value;

    if (!modelo || !ubicacion || !numeroSerie || estado === "") {
        alert("Rellena todos los campos");
        return;
    }

    const datos = {
        modelo: parseInt(modelo),
        ubicacion: parseInt(ubicacion),
        numero_serie: numeroSerie,
        estado: parseInt(estado),
        idGestor: gestorId
    };

    //DECISIÓN: crear o editar (son solo 2 opciones)
    if (recursoActual == null) {
        // CREAR
        rest.post("/api/recursos", datos, function (estado, respuesta) {
            if (estado === 201 || estado === 200) {
                alert("Recurso creado correctamente");
                cambiarSeccion("seccion_inicio");
                buscarRecurso();
            } else {
                alert("Error al crear recurso. Código: " + estado);
            }
        });

    } else {
        // EDITAR
        rest.put("/api/recursos/" + recursoActual, datos, function (estado, respuesta) {
            if (estado=== 200) {
                alert("Recurso actualizado correctamente");
                cambiarSeccion("seccion_inicio");
                buscarRecurso();
            } else if (estado=== 404) {
                alert("No existe ese recurso o modelo/ubicación inválidos");
            } else {
                alert("Error al actualizar recurso. Código: " + estado);
            }
        });
    }
}


function abrirRecurso(id) {
    recursoActual = id; //modo edicion para guardar cambios después

    rest.get("/api/recursos/" + id, function (estado, recurso) {
        if (estado=== 200) {

            // Rellenar selects
            rellenarSelect("recurso_categoria", categorias);
            rellenarSelect("recurso_modelo", modelos);
            rellenarSelect("recurso_ubicacion", ubicaciones);

            // Rellenar campos con datos del recurso
            document.getElementById("recurso_categoria").onchange = filtrarModelosFicha;

            //Averiguar la categoría del modelo del recurso 
            var categoriaModelo = "";
            for (let i = 0; i < modelos.length; i++) {
                if (parseInt(modelos[i].id) === parseInt(recurso.modelo)) {
                    categoriaModelo = modelos[i].categoria; // id de categoria
                    break;
                }
            }
            document.getElementById("recurso_categoria").value = categoriaModelo;//Poner categoría

            //Filtrar modelos según esa categoría
            filtrarModelosFicha();

            document.getElementById("recurso_modelo").value = recurso.modelo;
            document.getElementById("recurso_ubicacion").value = recurso.ubicacion;
            document.getElementById("recurso_num_serie").value = recurso.numero_serie;
            document.getElementById("recurso_estado").value = recurso.estado;

            cambiarSeccion("seccion_recurso");
            cargarReservas(id);
            cargarResenyas(id);

        } else {
            alert("Error al cargar recurso. Código: " + estado);
        }

    });
}



function filtrarModelosFicha() {
    const categoria = document.getElementById("recurso_categoria").value;

    if (categoria === "") {
        rellenarSelect("recurso_modelo", modelos);
        document.getElementById("recurso_modelo").value = "";
        return;
    }

    const catNum = parseInt(categoria);
    const filtrados = modelos.filter(m => m.categoria === catNum);
    rellenarSelect("recurso_modelo", filtrados);
    document.getElementById("recurso_modelo").value = "";
}

function cargarReservas(idRecurso) {
    rest.get("/api/recursos/" + idRecurso + "/reservas", function (estado, lista) { //la lista es un array de las reservas

        console.log("Estado:", estado);
        console.log("Reservas recibidas:", lista);

        if (estado!== 200) {
            alert("Error al cargar reservas. Código: " + estado);
            return;
        }

        const tbody = document.getElementById("tbody_reservas");
        tbody.innerHTML = "";

        for (let i = 0; i < lista.length; i++) {
            const reserva = lista[i];

            const fila = tbody.insertRow(-1); //creo una fila nueva al final de la tabla
            fila.className = obtenerClaseReserva(reserva);

            //me indica que poner en cada columna
            fila.insertCell(0).innerHTML = reserva.nombre_sanitario;
            fila.insertCell(1).innerHTML = reserva.horas_estimadas;
            fila.insertCell(2).innerHTML = formatearFecha(reserva.fecha_peticion);
            fila.insertCell(3).innerHTML = formatearFecha(reserva.fecha_inicio);
            fila.insertCell(4).innerHTML = formatearFecha(reserva.fecha_fin);
        }

    });
}

function cargarResenyas(idRecurso) {
    rest.get("/api/recursos/" + idRecurso + "/resenyas", function (estado, lista) {
        if (estado !== 200) {
            alert("Error al cargar reseñas. Código: " + estado);
            return;
        }

        const tbody = document.getElementById("tbody_resenyas");
        tbody.innerHTML = "";

        for (let i = 0; i < lista.length; i++) {

            const resenya = lista[i];
            const fila = tbody.insertRow(-1);

            fila.insertCell(0).innerHTML = formatearFecha(resenya.fecha);
            fila.insertCell(1).innerHTML = resenya.nombre_sanitario || "";
            fila.insertCell(2).innerHTML = resenya.valor;
            fila.insertCell(3).innerHTML = resenya.descripcion;
        }

    });
}


function obtenerClaseReserva(reserva) {
    const fechaActual = new Date();

    let fechaInicio=null; //creo la variable
    if (reserva.fecha_inicio){ //miro si la fecha existe
        fechaInicio= new Date (reserva.fecha_inicio); //si existe la convierto a Date y la guardo en la variable, sino se queda como null
    }
    let fechaFin= null;
    if (reserva.fecha_fin){
        fechaFin= new Date(reserva.fecha_fin);
    }

    //Reserva finalizada (blanco)
    if (fechaFin && fechaFin < fechaActual) { //compara si fecha fin existe y fecha fin es anterior a fecha actual (valor y comparacion)
        return "reserva_finalizada";
    }

    //Reserva pendiente (verde)
    if (fechaInicio && fechaInicio > fechaActual) {
        return "reserva_pendiente";
    }

    //Reserva en uso
    if (fechaInicio && fechaInicio <= fechaActual && (!fechaFin || fechaFin >= fechaActual)) {
        const horasEstimadas = Number(reserva.horas_estimadas);
        const horasEnUso = (fechaActual - fechaInicio) / (1000 * 60 * 60);

        // En uso y dentro del tiempo estimado (azul)
        if (!isNaN(horasEstimadas) && horasEnUso <= horasEstimadas) {
            return "reserva_en_uso_correcta";
        }

        // En uso y superó el tiempo estimado (rojo)
        return "reserva_en_uso_superada";
    }
    //Por defecto
    return "reserva_finalizada";
}

function formatearFecha(fecha) {
    if (!fecha) return "";
    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    const anio = fechaObj.getFullYear();
    const horas = String(fechaObj.getHours()).padStart(2, "0");
    const minutos = String(fechaObj.getMinutes()).padStart(2, "0");

    return dia + "/" + mes + "/" + anio + " " + horas + ":" + minutos;
}

//------------PRACTICA 3 DE TELEMEDICINA-----------------------------------
function obtenerReservasFinalizadas(callback) {

    // Primero obtenemos todos los recursos
    rest.get("/api/recursos", function (estado, recursos) {
        if (estado!== 200) {
            alert("Error al obtener los recursos");
            return;
        }

        var reservasFinalizadas= [];//guardo las reservas que cumplen las condiciones
        var pendientes= recursos.length; //cuanta cuantos recursos hay q consultar

        // Si no hay recursos, terminamos
        if (pendientes=== 0) {
            callback(reservasFinalizadas);
            return;
        }

        //recorro los recursos y pido sus reservas
        for (var i=0; i<recursos.length; i++) {
            let recurso=recursos[i];

            rest.get("/api/recursos/" + recurso.id + "/reservas", function (estado, reservas){

                    if (estado===200){

                        for (var j=0; j<reservas.length; j++) {
                            let reserva = reservas[j]; //utilizo let porque crea una variable indp para cada vuelta del bucle

                            // Solo reservas iniciadas y finalizadas, es decir, las realizadas
                            if (reserva.fecha_inicio!=null && reserva.fecha_fin!=null) {
                                reservasFinalizadas.push({
                                    ...reserva,
                                    categoria: nombreCategoriaPorModelo(recurso.modelo)
                                });
                            }
                        }
                    }
                    pendientes= pendientes-1;//voy restando 
                    // Esperamos a que terminen todas las peticiones
                    if (pendientes===0) {
                        callback(reservasFinalizadas);
                    }
                }
            );
        }
    });
}


//preparar los datos para enviar a la API
function enviarReservasFinalizadas(){
    obtenerReservasFinalizadas(function(reservasFinalizadas){
        var id_area= 11;
        var fecha= new Date().toISOString().slice(0,10);
        var datos=[];

        for (var i=0; i<reservasFinalizadas.length; i++){
            var reserva= reservasFinalizadas[i];

            var partes=reserva.nombre_sanitario.split(" ");
            var nombre= partes[0];
            var apellidos=partes.slice(1).join(" ");

            datos.push({
                nombre: nombre,
                apellidos: apellidos,
                "categoría": reserva.categoria,
                horas_estimadas: reserva.horas_estimadas,
                fec_pet: reserva.fecha_peticion,
                fec_ini: reserva.fecha_inicio,
                fecha_fin: reserva.fecha_fin
            });
        }

        var cuerpo= {
            id_area: id_area,
            fecha: fecha,
            datos: datos
        };

        rest.post("https://undefined.ua.es/telemedicina/api/datos", cuerpo, function(estado, respuesta){
            if (estado>= 200 && estado<300){
                alert("Reservas enviadas correctamente");

            } else{
                alert("Error al enviar las reservas: "+estado);
                console.log(respuesta);
            }
        });
    });
}

// Nombres de las áreas médicas
var nombresAreas={
    1: "Alergología",
    2: "Anestesiología",
    3: "Cardiología",
    4: "Cirugía General",
    5: "Dermatología",
    6: "Aparato Digestivo",
    7: "Endocrinología",
    8: "Ginecología",
    9: "Hematología",
    10: "Medicina Interna",
    11: "Neumología",
    12: "Neurología",
    13: "Oftalmología",
    14: "Oncología",
    15: "Pediatría",
    16: "Psiquiatría",
    17: "Traumatología",
    18: "Urología"
};

function cargarRankingReservas(){
    rest.get("https://undefined.ua.es/telemedicina/api/datos",function(estado,registros) {

        if (estado!== 200 || Array.isArray(registros)=== false) {
            alert("Error al obtener los datos del ranking");
            return;
        }

        var ranking= {};//guarda el contador de reservas de cada area

        // Inicializamos las 18 áreas
        for (var id= 1; id<=18; id++) {
            ranking[id]= 0;
        }
        console.log("Envíos recibidos:", registros);

        // Reviso cada envio recibido
        for (var i= 0; i<registros.length; i++) {
            var registro= registros[i];

            // Compruebo que el envío tenga una estructura válida
            //si no hay un envio o no es un objeto, lo ignoro
            if (registro===null || typeof registro!="object"){
                continue;
            }
            var idArea=Number(registro.id_area);//convierto el area en numero

            //el area debe ser un numero entre 1 y 18
            if (Number.isInteger(idArea)===false || (idArea<1 || idArea>18)){
                continue;
            }

            //compurebo la fecha de subida del envio
            if (fechaValida(registro.fecha)===false){
                continue;
            }

            //las reservas tienen q estar dentro de un array
            if (Array.isArray(registro.datos)===false){
                continue;
            }

            //AHORA RECORRO LAS RESERVAS DE ESE ENVÍO------------------
            for (var j= 0; j<registro.datos.length; j++) {
                var reserva= registro.datos[j];

                //si la reserva es null o no es un objeto, la ignoro
                if(reserva===null || typeof reserva!="object"){
                    continue;
                }

                //compruebo que el nombre sea texto y no esté vacio
                if (typeof reserva.nombre!=="string" || reserva.nombre.trim()==""){
                    continue;
                }
                //compruebo los apellidos 
                if (typeof reserva.apellidos!=="string" || reserva.apellidos.trim()==""){
                    continue;
                }

                //compruebo la categoria
                if (typeof reserva["categoría"]!=="string" || reserva["categoría"].trim()===""){
                    continue;
                }

                //convierto las horas a numeros
                var horas=Number(reserva.horas_estimadas);
                if (isNaN(horas) || horas<=0){//si no es un numero valido o menor igual a cero
                    continue;
                }

                //compruebo las 3 fechas de la reserva
                if (fechaValida(reserva.fec_pet)===false ||
                    fechaValida(reserva.fec_ini)=== false ||
                    fechaValida(reserva.fecha_fin)===false){
                    continue;
                }

                console.log("Reserva aceptada del área:", idArea, reserva);
                //pasa todos los filtros, cuento esta reserva en su area
                ranking[idArea]++;
            }
        }

        // CREO LA LISTA PARA ORDENAR
        var lista= [];

        for (var id= 1; id<= 18; id++) {
            lista.push({
                area: nombresAreas[id],
                cantidad: ranking[id]
            });
        }

        // ORDENO DE MAYOR A MENOR
        lista.sort(function(a, b) {
            return b.cantidad - a.cantidad;
        });

        // MUESTRO EL RANKING
        var tbody= document.getElementById("tbody_ranking");
        tbody.innerHTML="";//borra las filas anteriores

        for (var j= 0; j<lista.length; j++) {

            var fila= document.createElement("tr");//en cada vuelya creo una fila

            fila.innerHTML=
                "<td>" + (j + 1) + "</td>" +
                "<td>" + lista[j].area + "</td>" +
                "<td>" + lista[j].cantidad + "</td>";

            tbody.appendChild(fila);//anyade la fila a la tabla
        }
    });
}

// Comprueba que la fecha existe y es válida
function fechaValida(fecha) {
    //si la fecha llega como texto o contiene espacios vacios
    if (typeof fecha!== "string" || fecha.trim()==="") {
        return false;
    }

    //convierto el texto en una fecha
    var fechaConvertida= new Date(fecha);

    if (isNaN(fechaConvertida.getTime())){ //el getTime convierte numero la fecha y si no hay nada en NaN
        return false;
    }
    //si pasa las comprobaciones
    return true;
}
