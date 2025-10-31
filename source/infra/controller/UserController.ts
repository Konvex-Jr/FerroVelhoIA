import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import CreateFeedback from "../../useCases/createFeedback/CreateFeedback";
import CreateFeedbackInput from "../../useCases/createFeedback/CreateFeedbackInput";
import CreateUser from "../../useCases/createUser/CreateUser";
import CreateUserInput from "../../useCases/createUser/CreateUserInput";
import CreateUserOutput from "../../useCases/createUser/CreateUserOutput";
import LoginUser from "../../useCases/loginUser/LoginUser";
import LoginUserInput from "../../useCases/loginUser/LoginUserInput";

export default class UserController {

    constructor(protected repositoryFactory: RepositoryFactoryInterface) {
    }

    async createUser(input: CreateUserInput): Promise<CreateUserOutput> {
        const createUser = new CreateUser(this.repositoryFactory);
        return await createUser.execute(input);
    }

    async login(input: LoginUserInput): Promise<{ accessToken: string }> {
        const loginUser = new LoginUser(this.repositoryFactory);
        return await loginUser.execute(input);
    }
}