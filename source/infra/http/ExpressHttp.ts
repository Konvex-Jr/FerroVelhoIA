import express from "express";
import Http from "./Http";
import HttpMethods from "./HttpMethods";

export default class ExpressHttp implements Http {

	private app: any;

	constructor() {
		this.app = express();
		this.app.use(express.json());
		// @ts-ignore
		this.app.all('*', function (req, res, next) {
			res.header('Access-Control-Allow-Origin', '*');
			res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
			res.header('Access-Control-Allow-Headers', 'Content-Type, access-token');
			next();
		});
		// @ts-ignore
		this.app.options('*', function (req, res, next) {
			res.end();
		});
	}

	private async publicRoutes(method: HttpMethods, url: string, callback: any): Promise<any> {
		this.app[method](url, async function (req: any, res: any) {
			try {
				const result = await callback(req.params, req.body);
				res.json(result);
			} catch (exception: any) {
				console.error(exception);
				res.status(422).json({
					message: exception.message
				});
			}
		});
	}

	async route(method: HttpMethods, url: string, auth: boolean, callback: any): Promise<any> {
		this.publicRoutes(method, url, callback);
	}

	async listen(port: number): Promise<void> {
		await this.app.listen(port);
	}
}