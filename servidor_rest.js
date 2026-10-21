var express = require("express");
var jwt = require("jwt-simple");

var clave = "miSecretoMasOscuro"; // La misma clave que utiliza el servidor de avisos.
var app = express();
//var avisos = require("./servidor_socket");


//1. importar el cliente de supabase 
const { createClient } = require("@supabase/supabase-js");

//2. configurar con tu URL y tu public key
const supabaseUrl = 'https://kvfhobcayxzboocyrtsp.supabase.co';
const supabaseKey = 'sb_publishable_DzD7RBeUtyb34RuMqvA-hw_ud3SIxot';//<--Pegar aqui la public key
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Consultar los datos de los desplegables.
app.get("/api/modelos", async function(req, res) {
    const { data, error } = await supabase.from("modelos").select("*");
    if (error) return res.status(500).json("Error al consultar modelos");
    res.status(200).json(data);
});

app.get("/api/categorias", async function(req, res) {
    const { data, error } = await supabase.from("categorias").select("*");
    if (error) return res.status(500).json("Error al consultar categorias");
    res.status(200).json(data);
});

app.get("/api/ubicaciones", async function(req, res) {
    const { data, error } = await supabase.from("ubicaciones").select("*");
    if (error) return res.status(500).json("Error al consultar ubicaciones");
    res.status(200).json(data);
});

// Login: mantengo login y password porque son los campos que envia tu cliente.
app.post("/api/gestores/login", async function(req, res) {
    const { data: gestores, error } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", req.body.login)
        .eq("password", req.body.password);

    if (error) return res.status(500).json("Error al consultar el gestor");
    if (gestores.length !== 1) return res.status(403).json("Credenciales incorrectas");

    var contenido = {
        id: gestores[0].id,
        expira: Date.now() + 60 * 60 * 1000
    };
    var token = jwt.encode(contenido, clave);
    res.status(200).json({ id: gestores[0].id, token: token });
});

// Crear gestor.
app.post("/api/gestores", async function(req, res) {
    const { data: gestores, error } = await supabase
        .from("gestores").select("id").eq("usuario", req.body.usuario);
    if (error) return res.status(500).json("Error al consultar el usuario");
    if (gestores.length > 0) return res.status(403).json("El usuario ya existe");

    var nuevoGestor = {
        nombre: req.body.nombre,
        apellidos: req.body.apellidos,
        usuario: req.body.usuario,
        password: req.body.password
    };
    const { error: errorInsertar } = await supabase.from("gestores").insert(nuevoGestor);
    if (errorInsertar) return res.status(500).json("Error al crear el gestor");
    res.status(201).json("Gestor creado");
});

app.get("/api/gestores/:id", async function(req, res) {
    const { data: gestor, error } = await supabase.from("gestores")
        .select("id, nombre, apellidos, usuario")
        .eq("id", parseInt(req.params.id)).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el gestor");
    if (!gestor) return res.status(404).json("No existe ese id");
    res.status(200).json(gestor);
});

app.get("/api/sanitarios/:id", async function(req, res) {
    const { data: sanitario, error } = await supabase.from("sanitarios")
        .select("id, nombre, apellidos, usuario")
        .eq("id", parseInt(req.params.id)).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el sanitario");
    if (!sanitario) return res.status(404).json("No existe ese id");
    res.status(200).json(sanitario);
});

// Actualizar gestor.
app.put("/api/gestores/:id", async function(req, res) {
    var id = parseInt(req.params.id);
    const { data: gestor, error } = await supabase.from("gestores")
        .select("id").eq("id", id).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el gestor");
    if (!gestor) return res.status(404).json("No existe ese id");

    if (req.body.usuario !== undefined) {
        const { data: repetidos, error: errorUsuario } = await supabase.from("gestores")
            .select("id").eq("usuario", req.body.usuario).neq("id", id);
        if (errorUsuario) return res.status(500).json("Error al consultar el usuario");
        if (repetidos.length > 0) return res.status(403).json("El usuario ya existe");
    }

    // Solo actualizo los campos recibidos y permitidos.
    var cambios = {};
    if (req.body.nombre !== undefined) cambios.nombre = req.body.nombre;
    if (req.body.apellidos !== undefined) cambios.apellidos = req.body.apellidos;
    if (req.body.usuario !== undefined) cambios.usuario = req.body.usuario;
    if (req.body.password !== undefined) cambios.password = req.body.password;
    if (Object.keys(cambios).length === 0) return res.status(400).json("No hay datos para actualizar");

    const { error: errorActualizar } = await supabase.from("gestores").update(cambios).eq("id", id);
    if (errorActualizar) return res.status(500).json("Error al actualizar el gestor");
    res.status(200).json("Gestor actualizado");
});

// Consultar recursos con filtros opcionales.
app.get("/api/recursos", async function(req, res) {
    var consulta = supabase.from("recursos").select("*");
    if (req.query.modelo !== undefined) consulta = consulta.eq("modelo", parseInt(req.query.modelo));
    if (req.query.ubicacion !== undefined) consulta = consulta.eq("ubicacion", parseInt(req.query.ubicacion));
    if (req.query.estado !== undefined) consulta = consulta.eq("estado", parseInt(req.query.estado));

    if (req.query.categoria !== undefined) {
        // Primero busco los modelos de esa categoria.
        const { data: modelos, error } = await supabase.from("modelos")
            .select("id").eq("categoria", parseInt(req.query.categoria));
        if (error) return res.status(500).json("Error al consultar modelos");
        var idsModelos = [];
        for (var i = 0; i < modelos.length; i++) idsModelos.push(modelos[i].id);
        if (idsModelos.length === 0) return res.status(200).json([]);
        consulta = consulta.in("modelo", idsModelos);
    }

    const { data: recursos, error } = await consulta;
    if (error) return res.status(500).json({ error: "Error al obtener los recursos" });
    res.status(200).json(recursos);
});

app.get("/api/recursos/:id", async function(req, res) {
    const { data: recurso, error } = await supabase.from("recursos")
        .select("*").eq("id", parseInt(req.params.id)).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el recurso");
    if (!recurso) return res.status(404).json("No existe ese id");
    res.status(200).json(recurso);
});

// Crear recurso, comprobando su modelo y ubicacion.
app.post("/api/recursos", async function(req, res) {
    var idModelo = parseInt(req.body.modelo);
    const { data: modelo, error } = await supabase.from("modelos")
        .select("id").eq("id", idModelo).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el modelo");
    if (!modelo) return res.status(404).json("Modelo no existe");

    var idUbicacion = parseInt(req.body.ubicacion);
    const { data: ubicacion, error: errorUbicacion } = await supabase.from("ubicaciones")
        .select("id").eq("id", idUbicacion).maybeSingle();
    if (errorUbicacion) return res.status(500).json("Error al consultar la ubicacion");
    if (!ubicacion) return res.status(404).json("Ubicacion no existe");

    var nuevoRecurso = {
        modelo: idModelo,
        ubicacion: idUbicacion,
        numero_serie: req.body.numero_serie,
        estado: parseInt(req.body.estado)
    };
    // select().single() devuelve el recurso creado, incluido su id automatico.
    const { data: creado, error: errorInsertar } = await supabase.from("recursos")
        .insert(nuevoRecurso).select().single();
    if (errorInsertar) return res.status(500).json("Error al insertar el recurso");

    //avisos.avisarNuevoRecurso(req.gestorId, creado);
    res.status(201).json(creado);
});

app.put("/api/recursos/:id", async function(req, res) {
    var id = parseInt(req.params.id);
    const { data: recurso, error } = await supabase.from("recursos")
        .select("id").eq("id", id).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el recurso");
    if (!recurso) return res.status(404).json("No existe ese id");

    if (req.body.modelo !== undefined) {
        const { data: modelo, error: errorModelo } = await supabase.from("modelos")
            .select("id").eq("id", parseInt(req.body.modelo)).maybeSingle();
        if (errorModelo) return res.status(500).json("Error al consultar el modelo");
        if (!modelo) return res.status(404).json("Modelo no existe");
    }
    if (req.body.ubicacion !== undefined) {
        const { data: ubicacion, error: errorUbicacion } = await supabase.from("ubicaciones")
            .select("id").eq("id", parseInt(req.body.ubicacion)).maybeSingle();
        if (errorUbicacion) return res.status(500).json("Error al consultar la ubicacion");
        if (!ubicacion) return res.status(404).json("Ubicacion no existe");
    }

    var cambios = {};
    if (req.body.modelo !== undefined) cambios.modelo = parseInt(req.body.modelo);
    if (req.body.ubicacion !== undefined) cambios.ubicacion = parseInt(req.body.ubicacion);
    if (req.body.numero_serie !== undefined) cambios.numero_serie = req.body.numero_serie;
    if (req.body.estado !== undefined) cambios.estado = parseInt(req.body.estado);
    if (Object.keys(cambios).length === 0) return res.status(400).json("No hay datos para actualizar");

    const { error: errorActualizar } = await supabase.from("recursos").update(cambios).eq("id", id);
    if (errorActualizar) return res.status(500).json("Error al actualizar el recurso");
    res.status(200).json("Recurso actualizado");
});

app.delete("/api/recursos/:id", async function(req, res) {
    var id = parseInt(req.params.id);
    const { data: recurso, error } = await supabase.from("recursos")
        .select("id").eq("id", id).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el recurso");
    if (!recurso) return res.status(404).json("No existe ese id");

    const { error: errorBorrar } = await supabase.from("recursos").delete().eq("id", id);
    if (errorBorrar) return res.status(500).json("Error al borrar el recurso");
    res.status(204).send();
});

app.get("/api/recursos/:id/reservas", async function(req, res) {
    var id = parseInt(req.params.id);
    const { data: recurso, error } = await supabase.from("recursos")
        .select("id").eq("id", id).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el recurso");
    if (!recurso) return res.status(404).json("No existe ese id");

    // Supabase obtiene el sanitario relacionado mediante la clave foranea.
    const { data: reservas, error: errorReservas } = await supabase.from("reservas")
        .select("id, recurso, sanitario, horas_estimadas, fecha_peticion, fecha_inicio, fecha_fin, persona:sanitarios(nombre, apellidos)")
        .eq("recurso", id);
    if (errorReservas) return res.status(500).json("Error al consultar las reservas");

    // Mantengo nombre_sanitario con el formato que espera tu cliente.
    for (var i = 0; i < reservas.length; i++) {
        var persona = reservas[i].persona;
        reservas[i].nombre_sanitario = persona ? persona.nombre + " " + persona.apellidos : null;
        delete reservas[i].persona;
    }
    res.status(200).json(reservas);
});

app.get("/api/recursos/:id/resenyas", async function(req, res) {
    var id = parseInt(req.params.id);
    const { data: recurso, error } = await supabase.from("recursos")
        .select("id").eq("id", id).maybeSingle();
    if (error) return res.status(500).json("Error al consultar el recurso");
    if (!recurso) return res.status(404).json("No existe ese id");

    const { data: resenyas, error: errorResenyas } = await supabase.from("resenyas")
        .select("id, recurso, sanitario, fecha, valor, descripcion, persona:sanitarios(nombre, apellidos)")
        .eq("recurso", id);
    if (errorResenyas) return res.status(500).json("Error al consultar las resenyas");

    for (var i = 0; i < resenyas.length; i++) {
        var persona = resenyas[i].persona;
        resenyas[i].nombre_sanitario = persona ? persona.nombre + " " + persona.apellidos : null;
        delete resenyas[i].persona;
    }
    res.status(200).json(resenyas);
});

// Render proporciona el puerto mediante la variable PORT.
var puerto = process.env.PORT || 3000;
app.listen(puerto, function() {
    console.log("Servidor arrancado en el puerto:", puerto);
});
