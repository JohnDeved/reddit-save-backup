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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const saved_1 = __importDefault(require("@undefined/saved"));
fetch('https://raw.githubusercontent.com/JohnDeved/reddit-save-backup/de5edba5aaa5b9b886425127ce0d3e07c8fd70cb/old.saved.json')
    .then(res => res.json())
    .then((names) => __awaiter(void 0, void 0, void 0, function* () {
    // filter out already saved
    const storedNames = saved_1.default.map(s => s.name);
    const unStoredNames = names.filter(n => !storedNames.includes(n));
    (0, fs_1.writeFileSync)('./old.saved.json', JSON.stringify(unStoredNames, null, 2));
}));
