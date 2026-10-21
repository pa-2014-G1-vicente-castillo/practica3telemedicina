var conexion = require("./conexion_mysql.js");

var sql = "SELECT * FROM modelos";

conexion.query(sql, function(err, modelos) {

    if (err) {
        console.log("Error al realizar la consulta:", err);
    } else {
        console.log("Modelos:", modelos);
    }

});