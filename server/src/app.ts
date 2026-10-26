import express from 'express';import cors from 'cors';import helmet from 'helmet';import rateLimit from 'express-rate-limit';import { dirname,resolve } from 'node:path';import { fileURLToPath } from 'node:url';import { env } from './config/env.js';import { cases } from './routes/cases.js';import { errorHandler,requestId } from './middleware/errors.js';
export const app=express();app.disable('x-powered-by');app.use(helmet());app.use(cors({origin:env.clientOrigin}));app.use(express.json({limit:'20kb'}));app.use(requestId);app.use('/api/v1',rateLimit({windowMs:env.limitWindow,limit:env.limitMax,standardHeaders:true,legacyHeaders:false}));app.get('/api/v1/health',(_req,res)=>res.json({status:'ok'}));app.use('/api/v1/cases',cases);
if(env.nodeEnv==='production'){
  const clientBuild=resolve(dirname(fileURLToPath(import.meta.url)),'..','..','client','dist');
  app.use(express.static(clientBuild));
  app.use((req,res,next)=>{
    if(req.method==='GET'&&!req.path.startsWith('/api/'))return res.sendFile(resolve(clientBuild,'index.html'));
    next();
  });
}
app.use((_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found.'}}));app.use(errorHandler);
