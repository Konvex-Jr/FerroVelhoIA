import { hash } from "bcrypt";
import { sign } from "jsonwebtoken";
import { readFileSync } from "fs";
import CreateUserInput from "./CreateUserInput";
import CreateUserOutput from "./CreateUserOutput";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import UserRepositoryInterface from "../../domain/Interfaces/UserRepositoryInterface";
import User from "../../domain/Entity/User";

export default class CreateUser {

    readonly userRepository: UserRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.userRepository = repositoryFactory.createUserRepository();
    }

    async execute(input: CreateUserInput): Promise<CreateUserOutput> {
        if (input.password.length < 6) throw new Error("Invalid password");
        const encryptPassword = await hash(input.password, 10);
        const user = new User(input.email, encryptPassword);
        await this.userRepository.create(user);
        const privateKey = readFileSync('./private.key');
        const payload = {
            userId: user.id,
            userEmail: user.email
        }
        const accessToken = sign(payload, privateKey, {
            algorithm: "RS256",
            expiresIn: "2h"
        });
        return {
            accessToken
        }
    }

}