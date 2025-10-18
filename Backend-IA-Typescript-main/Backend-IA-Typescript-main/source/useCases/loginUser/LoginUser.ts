import { compare } from "bcrypt";
import { readFileSync } from "fs";
import { sign } from "jsonwebtoken";
import UserRepositoryInterface from "../../domain/Interfaces/UserRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import LoginUserInput from "./LoginUserInput";
import LoginUserOutput from "./LoginUserOutput";

export default class LoginUser {

    readonly userRepository: UserRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.userRepository = repositoryFactory.createUserRepository();
    }

    async execute(input: LoginUserInput): Promise<LoginUserOutput> {
        const user = await this.userRepository.findByEmail(input.email);
        if(!user) throw new Error("Invalid credentials");
        const isEqual = await compare(input.password, user.password);
        if (!isEqual) throw new Error("Invalid credentials");
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