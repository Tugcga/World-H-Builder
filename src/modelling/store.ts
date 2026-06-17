import { Connection } from "../math/connection";
import { Door } from "../math/door";
import { Point } from "../math/point";
import { Vector2D } from "../math/vector";
import { Zone } from "../math/zone";
import { delete_geometry, GeometryRecord, load_all_geometry, save_geometry } from "./db_connector";
import { RoomStore } from "./room";

export async function save_room(room: RoomStore) {
    if (room.is_empty()) {
        // skip store empty rooms
        return;
    }
    const record: GeometryRecord = {
        id: room.get_id(),
        preview_img: room.get_preview(),
        name: room.get_name(),
        collections: room.get_collections(),
        closed_cycles: room.get_all_closed().map(cycle =>
            cycle.map(v => ({ x: v.get_x(), y: v.get_y() }))
        ),
        constructed_cycle: room.get_constructed().map(v =>
            ({ x: v.get_x(), y: v.get_y() })
        ),
        points: room.get_points().map(p => ({x: p.get_position().get_x(), y: p.get_position().get_y(), a: p.get_angle()})),
        zones: room.get_zones().map(z => ({x: z.get_position().get_x(), y: z.get_position().get_y(), r: z.get_radius()})),
        connections: room.get_connections().map(c => ({s_x: c.get_start().get_x(), s_y: c.get_start().get_y(), e_x: c.get_end().get_x(), e_y: c.get_end().get_y()})),
        doors: room.get_doors().map(d => ({x: d.get_center().get_x(), y: d.get_center().get_y(), a: d.get_angle()}))
    };
    await save_geometry(record);
}

export async function load_rooms(): Promise<Map<number, RoomStore>> {
    const to_return = new Map<number, RoomStore>();

    const rooms = await load_all_geometry();
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i] as GeometryRecord;
        const new_storage = new RoomStore(room.closed_cycles.map(cycle => cycle.map(v => (new Vector2D(v.x, v.y)))),
                                          room.constructed_cycle.map(v => (new Vector2D(v.x, v.y))),
                                          room.id, room.preview_img, room.name, room.collections.join(" "),
                                          room.points ? room.points.map(p => (new Point(new Vector2D(p.x, p.y), p.a))) : new Array<Point>(),
                                          room.zones ? room.zones.map(z => (new Zone(new Vector2D(z.x, z.y), z.r))) : new Array<Zone>(),
                                          room.connections ? room.connections.map(c => (new Connection(new Vector2D(c.s_x, c.s_y), new Vector2D(c.e_x, c.e_y)))) : new Array<Connection>(),
                                          room.doors ? room.doors.map(d => (new Door(new Vector2D(d.x, d.y), d.a))) : new Array<Door>());
        to_return.set(room.id, new_storage);
    }

    return to_return;
}

export async function delete_room(id: number) {
    await delete_geometry(id);
}