import { Service } from "@tsed/common";
import { ConnectionPool } from "mssql";

@Service()
export class SqlServer {

    private config = {
        user: process.env.USERNAME,
        password: process.env.PASSWORD,
        server: process.env.HOST,
        database: process.env.DATABASE
    }
    private pool : ConnectionPool = null

    constructor() {

    }

    public async init(sprocs: {name: string, query: string}[] = []) {
        try {
            const pool = await new ConnectionPool(this.config).connect()
            for (let sproc of sprocs) {
                await pool.request().query(`DROP PROCEDURE IF EXISTS ${sproc.name}`)
                await pool.request().query(`${sproc.query}`)
            }
        }
        catch (e) {
            return Promise.reject(e)
        }
    }

    public async execute(sproc: string, params: any, nestTables = false, isNumeric = false) {
        try {
            const connection = await this.getConnection()
            const formattedParams = Array.isArray(params) && params.length > 1 ? isNumeric ? params.join(',') : params.join('\',\'') : isNumeric ? params[0] : `'${params[0]}'`
            const query = `CALL ${sproc}(${formattedParams})`
            const [results, ] = nestTables ? await connection.query({sql: query, nestTables: true}) : await connection.query(query)
            await connection.release()
            return results
        } catch (err) {
            const timestamp = new Date()
            err.message = `${timestamp} Database error : ${err.message}`
            console.log(err)
            return {
                error: true,
                message: "There was a problem with the database operation"
            }
        }
    }

    public async getConnection() {
        try {
            if(this.pool){
                return this.pool
            }
            this.pool = await new ConnectionPool(this.config).connect()
            this.pool.on("error", async err => {
                console.log("connection error", err)
                this.closePool()
            })
            return this.pool
        } catch(e) {
            this.pool = null
            console.log("an error occured connnecting", e)
        }
    }

    public async closePool() {
        try {
            await this.pool.close();
            this.pool = null
        } catch(e) {
            this.pool = null
            console.log("error occured closing pool", e)
        }
    }
}
