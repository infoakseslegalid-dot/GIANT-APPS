// @ts-nocheck
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const STORAGE_BASE = (process.env.INTEGRATION_PROXY_URL || "").trim() || "https://integrations.emergentagent.com";
const STORAGE_URL = STORAGE_BASE.replace(/\/$/, "") + "/objstore/api/v1/storage";
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;
const APP_NAME = "ali-workspace";
const LOCAL_STORAGE_DIR = path.join(process.cwd(), "local_storage");

let storageKey: string | null = null;

export async function initStorage(force: boolean = false): Promise<string> {
    if (!EMERGENT_KEY) {
        fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
        return "local";
    }
    if (storageKey && !force) {
        return storageKey;
    }
    try {
        const resp = await axios.post(`${STORAGE_URL}/init`, { emergent_key: EMERGENT_KEY }, { timeout: 10000 });
        storageKey = resp.data.storage_key;
        return storageKey as string;
    } catch (e: any) {
        console.warn(`Emergent storage init failed, falling back to local storage: ${e.message}`);
        fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
        return "local";
    }
}

export async function putObject(objectPath: string, data: Buffer, contentType: string): Promise<any> {
    const key = await initStorage();
    
    if (key === "local" || !EMERGENT_KEY) {
        fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
        const target = path.join(LOCAL_STORAGE_DIR, objectPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
        return { path: objectPath, size: data.length };
    }
    
    try {
        const resp = await axios.put(
            `${STORAGE_URL}/objects/${objectPath}`,
            data,
            {
                headers: {
                    "X-Storage-Key": key,
                    "Content-Type": contentType
                },
                timeout: 120000
            }
        );
        return resp.data;
    } catch (e: any) {
        console.warn(`Remote put_object failed, falling back to local storage: ${e.message}`);
        fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
        const target = path.join(LOCAL_STORAGE_DIR, objectPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
        return { path: objectPath, size: data.length };
    }
}

export async function getObject(objectPath: string): Promise<{ data: Buffer, contentType: string }> {
    let key = await initStorage();
    
    if (key === "local" || !EMERGENT_KEY) {
        const target = path.join(LOCAL_STORAGE_DIR, objectPath);
        if (fs.existsSync(target)) {
            return { data: fs.readFileSync(target), contentType: "application/octet-stream" };
        }
        throw new Error(`File ${objectPath} not found`);
    }
    
    try {
        let resp = await axios.get(`${STORAGE_URL}/objects/${objectPath}`, {
            headers: { "X-Storage-Key": key },
            responseType: 'arraybuffer',
            validateStatus: status => status < 500,
            timeout: 60000
        });
        
        if (resp.status === 404) {
            key = await initStorage(true);
            resp = await axios.get(`${STORAGE_URL}/objects/${objectPath}`, {
                headers: { "X-Storage-Key": key },
                responseType: 'arraybuffer',
                timeout: 60000
            });
        }
        
        if (resp.status >= 400) {
            throw new Error(`Request failed with status code ${resp.status}`);
        }
        
        return {
            data: Buffer.from(resp.data),
            contentType: resp.headers['content-type'] || "application/octet-stream"
        };
    } catch (e: any) {
        const target = path.join(LOCAL_STORAGE_DIR, objectPath);
        if (fs.existsSync(target)) {
            return { data: fs.readFileSync(target), contentType: "application/octet-stream" };
        }
        throw e;
    }
}
