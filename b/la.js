"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var anchor = require("@coral-xyz/anchor");
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var secretKey, walletKeypair, connection, provider, programId, idl, program, mintPubkey, tokenAccountPubkey, txSignature, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    secretKey = Uint8Array.from([
                        13, 55, 88, 172, 167, 254, 203, 27, 243, 163, 143, 31, 139, 149, 255, 39,
                        174, 41, 35, 207, 98, 31, 24, 76, 24, 180, 171, 102, 32, 70, 87, 193,
                        226, 32, 196, 37, 25, 8, 93, 195, 8, 110, 205, 76, 126, 199, 23, 125,
                        159, 79, 71, 63, 153, 203, 81, 31, 116, 124, 80, 95, 160, 28, 244, 127
                    ]);
                    walletKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
                    connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
                    provider = new anchor.AnchorProvider(connection, new anchor.Wallet(walletKeypair), { preflightCommitment: "confirmed" });
                    anchor.setProvider(provider);
                    programId = new web3_js_1.PublicKey("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");
                    idl = {
                        version: "0.0.0",
                        name: "l",
                        instructions: [
                            {
                                name: "mintOne",
                                accounts: [
                                    { name: "mint", isMut: true, isSigner: false },
                                    { name: "tokenAccount", isMut: true, isSigner: false },
                                    { name: "authority", isMut: false, isSigner: true },
                                    { name: "tokenProgram", isMut: false, isSigner: false },
                                ],
                                args: [],
                            },
                        ],
                    };
                    program = new anchor.Program(idl, provider, programId);
                    mintPubkey = new web3_js_1.PublicKey("BNW1SZibkGWT8qMgcigzTq7gW2vsXH6Dbpk1Pvqph2Jm");
                    tokenAccountPubkey = new web3_js_1.PublicKey("9NVsATCUsiWvcTvimFfQJhvPd2ffaTNetqxwAUj8vUCt");
                    console.log("Отправка транзакции (вызов mintOne)...");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, program.methods.mintOne()
                            .accounts({
                            mint: mintPubkey,
                            tokenAccount: tokenAccountPubkey,
                            authority: walletKeypair.publicKey,
                            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                        })
                            .rpc()];
                case 2:
                    txSignature = _a.sent();
                    console.log("Транзакция успешно выполнена. Signature:", txSignature);
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error("Ошибка при выполнении транзакции:", err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log("Скрипт завершён"); })
    .catch(function (err) { return console.error(err); });
