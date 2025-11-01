// User.ts não será utilizado, visto que o usuário será identificado apenas com o id do whats (wa_id)

import { v4 as uuid } from "uuid";

export default class User {
    readonly id: string;
    readonly email: string;
    readonly password: string;
    constructor(
        email: string,
        password: string,
        id?: string
    ) {
        if (!id) id = uuid();
        this.id = id;
        this.email = email;
        this.password = password;
    }
}