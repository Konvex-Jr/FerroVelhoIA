import User from "../../../domain/Entity/User";
import UserRepositoryInterface from "../../../domain/Interfaces/UserRepositoryInterface";

export default class UserRepositoryMemory implements UserRepositoryInterface {

    private users: User[];

    constructor() {
        this.users = [];
    }
    
    async create(user: User): Promise<User> {
        const exists = this.users.find(existentUser => existentUser.email === user.email);
        if (exists) throw new Error("Email already exists");
        this.users.push(user);
        return user;
    }

    async findById(id: string): Promise<User | null> {
        const user = this.users.find(user => user.id === id);
        if (!user) throw new Error("User not found");
        return user;
    }
    
    async findByEmail(email: string): Promise<User> {
        const user = this.users.find(user => user.email === email);
        if (!user) throw new Error("User not found");
        return user;
    }

    async getAll(): Promise<User[]> {
        return this.users;
    }

    async update(user: User): Promise<User> {
        const index = this.users.findIndex(existingUser => existingUser.id === user.id);
        if (index === -1) throw new Error("User not found");
        this.users[index] = user;
        return user;
    }
}