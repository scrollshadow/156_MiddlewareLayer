import "dotenv/config";
import express from 'express';
import pg from "pg";
import Joi, { allow } from "joi";

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
            statusCode: req.statusCode,
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

function errorResponese(res, message, data, status = null){
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
    const{id, nama, nim, kelas} = req.body
    const result = await pool.query(
        `insert into biodata (id, nama, nim, kelas)
        values ($1, $2, $3, $4)
        returning *`
        [id?? null, nama, nim, kelas]
    )
    return successResponese(res, 'data berhasil ditambahkan', result.rows[0], 201)
})