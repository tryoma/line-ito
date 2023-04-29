"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const line_1 = require("../controllers/line");
const router = (0, express_1.Router)();
router.post('/', line_1.lineEndpoint);
exports.default = router;
