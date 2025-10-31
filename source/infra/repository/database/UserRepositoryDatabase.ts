import User from "../../../domain/Entity/User";
import UserRepositoryInterface from "../../../domain/Interfaces/UserRepositoryInterface";
import Connection from "../../database/Connection";

export default class UserRepositoryDatabase implements UserRepositoryInterface {

    constructor(protected connection: Connection) {
    }

    async create(user: User): Promise<User | null> {
        const exists = await this.findByEmail(user.email);
        if (!exists) throw new Error("Email already exists");
        await this.connection.execute("insert into users (id, email, password) values ($1, $2, $3);", [user.id, user.email, user.password]);
        return await this.findById(user.id);
    }

    async findById(id: string): Promise<User | null> {
        const result = await this.connection.execute("select id, email, password from users where id = $1", [id]);
        if (result.length === 0) return null;
        return new User(result[0].email, result[0].password, result[0].id);
    }

    async findByEmail(email: string): Promise<User | null> {
        const result = await this.connection.execute("select id, email, password from users where email = $1", [email]);
        if (result.length === 0) return null;
        return new User(result[0].email, result[0].password, result[0].id);
    }

    async getAll(): Promise<User[]> {
        const result = await this.connection.execute("select id, email, password from users");
        return result.map((user: any) => new User(user.email, user.password, user.id));
    }

    async update(user: User): Promise<User> {
        await this.connection.execute("update users set email = $1, password = $2 where id = $3", [user.email, user.password, user.id]);
        return user;
    }
}