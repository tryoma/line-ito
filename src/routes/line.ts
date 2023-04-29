import { Router } from 'express';
import { lineEndpoint } from '../controllers/line';

const router = Router();

router.post('/', lineEndpoint);

export default router;