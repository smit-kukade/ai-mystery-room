import express from 'express';import cors from 'cors';import helmet from 'helmet';import rateLimit from 'express-rate-limit';import session from 'express-session';import MongoStore from 'connect-mongo';import { dirname,resolve } from 'node:path';import { fileURLToPath } from 'node:url';import { env,sessionCookieName } from './config/env.js';import { cases } from './routes/cases.js';import { auth } from './routes/auth.js';import { errorHandler,requestId } from './middleware/errors.js';
export const app=express();
export const sessionStore=MongoStore.create({mongoUrl:env.mongoUri,collectionName:'sessions',ttl:14*24*60*60,autoRemove:'native'});
if(env.nodeEnv==='production')app.set('trust proxy',1);
app.disable('x-powered-by');app.use(helmet());app.use(cors({origin:env.clientOrigin,credentials:true}));app.use(express.json({limit:'20kb'}));app.use(requestId);
app.use(session({name:sessionCookieName,secret:env.sessionSecret,resave:false,saveUninitialized:false,rolling:true,proxy:env.nodeEnv==='production',store:sessionStore,cookie:{httpOnly:true,secure:env.nodeEnv==='production',sameSite:'lax',path:'/',maxAge:14*24*60*60*1000}}));
app.use('/api/v1',( _req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});app.use('/api/v1',rateLimit({windowMs:env.limitWindow,limit:env.limitMax,standardHeaders:true,legacyHeaders:false}));app.get('/api/v1/health',(_req,res)=>res.json({status:'ok'}));app.use('/api/v1/auth',auth);app.use('/api/v1/cases',cases);
if(env.nodeEnv==='production'){
  const clientBuild=resolve(dirname(fileURLToPath(import.meta.url)),'..','..','client','dist');
  app.use(express.static(clientBuild));
  app.use((req,res,next)=>{
    if(req.method==='GET'&&!req.path.startsWith('/api/'))return res.sendFile(resolve(clientBuild,'index.html'));
    next();
  });
}
app.use((_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Route not found.'}}));app.use(errorHandler);
