import "dotenv/config";
import express from 'express';
import pg from "pg";
import Joi from "joi";

const app = express()
const port = process.env.PORT 
const { Pool } = pg

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})

app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.use((req, res, next) =>{
    const start = Date.now()

    res.on('finish', () =>{
        const duration = Date.now() - start
        console.log({
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration} ms`
        })
    })
    next()
})

function successResponese(res, message, data, status = 200){
    return res.status(status).json({
        success: true, message, data, error: null,
    })
}

function errorResponese(res, message, status = 500, details = null){
    return res.status(status).json({
        success: false, message, data:null, error: details,
    })
}

const biodataSchema = Joi.object({
    id: Joi.number().integer().positive(),
    nama: Joi.string().trim().min(2).max(100).required(),
    nim: Joi.string().trim().min(5).max(20).required(),
    kelas: Joi.string().trim().min(1).max(20).required(),
})

const idSchema = Joi.object({
    id: Joi.number().integer().positive().required(),
})

function validateBody(schema){
    return(req, res, next) => {
        const {error, value} = schema.validate(req.body, {
            abortEarly:false, convert : true, allowUnknown: false
        });
        if(error){
            return errorResponese(
                res,
                'validasi input gagal',
                400,
                error.details.map(item=>({
                    field: item.path.join('.'),
                    message: item.message,
                }))
            )
        }
        req.body = value,
        next()
    }
}

function validateParams(schema){
    return(req, res, next) => {
        const {error, value} = schema.validate(req.params);
        if(error){
            return errorResponese(
                res,
                'parameter tidak valid',
                400,
                error.details.map(item=>({
                    field: item.path.join('.'),
                    message: item.message,
                }))
            )
        }
        req.params = value,
        next()
    }
}

app.get('/', async(req, res) => {
    const result = await pool.query('select * from biodata order by id')
    return successResponese(res, 'data berhasil diambil', result.rows)
})

app.post('/biodata', validateBody(biodataSchema), async(req, res)=>{
    try {
        const{ nama, nim, kelas} = req.body
        const result = await pool.query(
            `insert into biodata (nama, nim, kelas)
            values ($1, $2, $3)
            returning *`,
            [nama, nim, kelas]
        )
        return successResponese(res, 'data berhasil ditambahkan', result.rows[0], 201)
    } catch (err) {
        console.error('POST /biodata error:', err)
        return errorResponese(res, 'Gagal menambahkan data', 500, err.message)
    }
})

app.put(
    "/biodata/:id",
    validateParams(idSchema),
    validateBody(biodataSchema.fork(
        ['nama', 'nim', 'kelas'], 
        (field) => field.required()
    ).fork(['id'], field => field.forbidden())),
    async (req, res) => {
        const { id } = req.params
        const { nama, nim, kelas } = req.body

        const result = await pool.query(
            `UPDATE biodata
            SET nama = $1, nim = $2, kelas = $3
            WHERE id = $4
            RETURNING *`,
            [nama, nim, kelas, id]
        )

        if (result.rowCount === 0) {
            return errorResponese(
                res, 'Data tidak ditemukan', 404
            )
        }

        return successResponese(
            res,
            'Data berhasil diupdate',
            result.rows[0]
        )
    }
)

app.delete(
    '/biodata/:id',
    validateParams(idSchema),
    async (req, res) => {
        const { id } = req.params

        const result = await pool.query(
            `DELETE FROM biodata WHERE id = $1 RETURNING *`,
            [id]
        )

        if (result.rowCount === 0) {
            return errorResponese(
                res, 'Data tidak ditemukan', 404
            )
        }

        return successResponese(
            res,
            'Data berhasil dihapus',
            result.rows[0]
        )
    }
)

app.use((req, res) => {
    return errorResponese(
        res,
        'Endpoint tidak ditemukan',
        404
    )
})


app.use((err, req, res, next) => {
    console.error(err)

    if (res.headersSent){
        return next(err)
    }

    return errorResponese(
        res,
        'Terjadi kesalahan pada server',
        500,
        err.message
    )
})

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})