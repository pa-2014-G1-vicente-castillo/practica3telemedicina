const mysql = require('mysql');
const database = {
    host : 'localhost',
    user : 'tele2026',
    password : 'familia123.',
    database : 'telemedicina2026_practicas'
};

const conexion = mysql.createConnection(database);

//var sql = "select * from medicos where hospital = 2";
//var sql = "insert into hospitales (nombre, localidad, camas) values ('Hospital de Villajoyosa','Villajoyosa',290)";
//var sql = "update medicos set nombre = 'David' where nombre = 'Julio López'";
//var sql = "delete * from hospitales where identificador = 1"

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:',err);
        process.exit();
    }
});
module.exports = conexion;

