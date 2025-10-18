import { ModelType } from "../Enums/ModelType";
import { TokenType } from "../Enums/TokenType";

export default class Token {
    readonly model: ModelType;
    readonly type: TokenType;
    readonly amount: number;
    readonly createdAt: Date;

    constructor(
        model: ModelType,
        type: TokenType,
        amount: number
    ) {
        this.model = model;
        this.type = type;
        this.amount = amount;
        this.createdAt = new Date();
    }
}