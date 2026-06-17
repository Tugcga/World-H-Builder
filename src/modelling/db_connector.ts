import { openDB, DBSchema } from "../../node_modules/idb/build/index";

export interface GeometryRecord {
    id: number;
    preview_img: string;
    name: string;
    collections: string[];
    
    closed_cycles: Array<Array<{ x: number; y: number }>>;
    constructed_cycle: Array<{ x: number; y: number }>;
    points: Array<{x: number, y: number, a: number}>;
    zones: Array<{x: number, y: number, r: number}>;
    connections: Array<{s_x: number, s_y: number, e_x: number, e_y: number}>;
    doors: Array<{x: number, y: number, a: number}>
}

interface ModellerDB extends DBSchema {
    geometry: {
        key: number;
        value: GeometryRecord;
    };
}

const db_promise = openDB<ModellerDB>("modeller_db", 1, {
    upgrade(db) {
        db.createObjectStore("geometry", { keyPath: "id" });
    },
});

export async function save_geometry(record: GeometryRecord): Promise<void> {
    const db = await db_promise;
    await db.put("geometry", record);
}

export async function load_all_geometry(): Promise<GeometryRecord[]> {
    const db = await db_promise;
    return await db.getAll("geometry");
}

export async function load_geometry(id: number): Promise<GeometryRecord | undefined> {
    const db = await db_promise;
    return await db.get("geometry", id);
}

export async function delete_geometry(id: number): Promise<void> {
    const db = await db_promise;
    await db.delete("geometry", id);
}