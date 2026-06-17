import { Transform } from "../../math/transform";
import { Vector2D } from "../../math/vector";
import { RoomConstructor } from "../room";
import { DRAW_CONNECTION_COLOR, DRAW_CONNECTION_POINT_SIZE, DRAW_CONNECTION_STROKE_SIZE, DRAW_DOOR_COLOR, DRAW_DOOR_LINE_SIZE, DRAW_DOOR_POINT_SIZE, DRAW_LINE_COLOR, DRAW_LINE_SIZE, DRAW_POINT_LABEL_COLOR, DRAW_POINT_LABEL_FONT, DRAW_POINT_LABEL_SIZE, DRAW_POINT_OUTER_ANGLE_DELTA, DRAW_POINT_OUTER_ANGLE_SIZE, DRAW_POINT_OUTER_COLOR, DRAW_POINT_OUTER_SIZE, DRAW_POINT_OUTER_STROKE_COLOR, DRAW_POINT_OUTER_STROKE_SIZE, DRAW_POINT_SIZE, DRAW_ROOM_COLOR, DRAW_SELECTED_VERTEX_COLOR, DRAW_ZONE_BORDER_COLOR, DRAW_ZONE_CENTER_COLOR, DRAW_ZONE_OUTER_STROKE_COLOR, DRAW_ZONE_OUTER_STROKE_SIZE } from "../styles";
import { RoomConstructDirection, RoomConstructMode, Tool, UpdateCanvasMode } from "../types";
import { ACanvas } from "./canvas_abstract";

export class BlueprintCanvas extends ACanvas {
    private room: RoomConstructor = new RoomConstructor(0);
    private potential_point_do_add: Vector2D | null = null;
    private selected_indices: Array<number> = new Array<number>();  // selected indices contains indices in all paths (closed and non-closed last constructed cycle)

    constructor(root_div: HTMLDivElement, canvas_id: string, zone_id: string) {
        super(root_div, canvas_id, zone_id);
    }

    define_blueprint_context(in_room: RoomConstructor, in_potential_point: Vector2D | null, in_selected_indices: Array<number>) {
        this.room = in_room;
        this.potential_point_do_add = in_potential_point;
        this.selected_indices = in_selected_indices;
    }

    draw(ctx: CanvasRenderingContext2D, tfm: Transform, ignore_selection: boolean): void {
        // we should draw all cycles as one shape
        ctx.strokeStyle = DRAW_LINE_COLOR;
        ctx.fillStyle = DRAW_ROOM_COLOR;
        ctx.lineWidth = DRAW_LINE_SIZE;
        ctx.beginPath();
        const closed_cycles = this.room.get_closed_cycles();
        for (let i = 0; i < closed_cycles.length; i++) {
            const cycle = closed_cycles[i];
            const start_point: Vector2D = cycle[0];
            const start_point_canvas = tfm.apply(start_point);
            ctx.moveTo(start_point_canvas.get_x(), start_point_canvas.get_y());

            for (let i = 1; i < cycle.length; i++) {
                const p: Vector2D = cycle[i];
                const p_canvas: Vector2D = tfm.apply(p);
                ctx.lineTo(p_canvas.get_x(), p_canvas.get_y());
            }

            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();

        // separately draw non-closed cycle
        const last_path = this.room.get_constructed_cycle();
        if (last_path.length > 0) {
            ctx.beginPath();
            const start_point: Vector2D = last_path[0];
            const start_point_canvas = tfm.apply(start_point);
            ctx.moveTo(start_point_canvas.get_x(), start_point_canvas.get_y());

            for (let i = 1; i < last_path.length; i++) {
                const p: Vector2D = last_path[i];
                const p_canvas: Vector2D = tfm.apply(p);
                ctx.lineTo(p_canvas.get_x(), p_canvas.get_y());
            }

            const room_mode = this.room.get_draw_mode();
            if (this.active_tool == Tool.WallDraw && room_mode == RoomConstructMode.DrawWalls && this.potential_point_do_add != null) {
                // in continuous draw also draw to the current potential position
                // but with respect to the orientation, we should move either to first or last cycle point
                const last_p = this.room.get_direction_mode() == RoomConstructDirection.Head ? last_path[0] : last_path[last_path.length - 1];
                const last_p_canvas = tfm.apply(last_p);
                ctx.moveTo(last_p_canvas.get_x(), last_p_canvas.get_y());

                const last_canvas = tfm.apply(this.potential_point_do_add);
                ctx.lineTo(last_canvas.get_x(), last_canvas.get_y());
            }
            ctx.stroke();
        }
        
        // next draw all vertices
        // again, at first for closed cycles, then for constructed path
        ctx.fillStyle = DRAW_LINE_COLOR;
        let start_vertex_index = 0;
        for (let i = 0; i < closed_cycles.length; i++) {
            const cycle = closed_cycles[i];
            for (let j = 0; j < cycle.length; j++) {
                const p = cycle[j];
                const p_canvas = tfm.apply(p);
                // selected indices use the common enumeration
                // but j - is the local index in the cycle
                // so, increase but the counter from all previous paths
                const is_selected = this.selected_indices.includes(j + start_vertex_index) && !ignore_selection;

                if (is_selected) {
                    ctx.fillStyle = DRAW_SELECTED_VERTEX_COLOR;
                }
                ctx.beginPath();
                ctx.arc(p_canvas.get_x(), p_canvas.get_y(), DRAW_POINT_SIZE, 0, 2 * Math.PI, false);
                ctx.fill();

                // revert fill color
                if (is_selected) {
                    ctx.fillStyle = DRAW_LINE_COLOR;
                }
            }
            start_vertex_index += cycle.length;
        }

        // also for constructed path
        for (let i = 0; i < last_path.length; i++) {
            const p = last_path[i];
            const p_canvas = tfm.apply(p);
            const is_selected = this.selected_indices.includes(i + start_vertex_index) && !ignore_selection;

            if (is_selected) {
                ctx.fillStyle = DRAW_SELECTED_VERTEX_COLOR;
            }
            ctx.beginPath();
            ctx.arc(p_canvas.get_x(), p_canvas.get_y(), DRAW_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();
            if (is_selected) {
                ctx.fillStyle = DRAW_LINE_COLOR;
            }
        }
        start_vertex_index += last_path.length;

        const room_points = this.room.get_points();
        for (let i = 0; i < room_points.length; i++) {
            const point = room_points[i];

            const p = point.get_position();
            const angle = point.get_angle();
            const p_canvas = tfm.apply(p);
            const r_canvas = tfm.get_scale().get_x() * DRAW_POINT_OUTER_SIZE;
            const a_canvas = tfm.get_scale().get_x() * DRAW_POINT_OUTER_ANGLE_SIZE;

            const is_selected = this.selected_indices.includes(i + start_vertex_index) && !ignore_selection;

            ctx.fillStyle = DRAW_POINT_OUTER_COLOR;
            ctx.strokeStyle = DRAW_POINT_OUTER_STROKE_COLOR;
            ctx.lineWidth = DRAW_POINT_OUTER_STROKE_SIZE;
            ctx.beginPath();
            ctx.arc(p_canvas.get_x(), p_canvas.get_y(), r_canvas, angle + DRAW_POINT_OUTER_ANGLE_DELTA, angle - DRAW_POINT_OUTER_ANGLE_DELTA, false);
            ctx.lineTo(p_canvas.get_x() + Math.cos(angle) * a_canvas, p_canvas.get_y() + Math.sin(angle) * a_canvas);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = is_selected ? DRAW_SELECTED_VERTEX_COLOR : DRAW_LINE_COLOR;
            ctx.beginPath();
            ctx.arc(p_canvas.get_x(), p_canvas.get_y(), DRAW_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();

            ctx.font = "bold " + DRAW_POINT_LABEL_SIZE.toString() + "px" + " " + DRAW_POINT_LABEL_FONT;

            ctx.fillStyle = DRAW_POINT_LABEL_COLOR;
            ctx.textBaseline = "middle";
            ctx.fillText(i.toString(), p_canvas.get_x() + 8, p_canvas.get_y());
        }

        start_vertex_index += room_points.length;

        const room_zones = this.room.get_zones();
        for (let i = 0; i < room_zones.length; i++) {
            const zone = room_zones[i];
            const p = zone.get_position();
            const r = zone.get_radius();
            const p_canvas = tfm.apply(p);
            const r_canvas = r * tfm.get_scale().get_x();

            const gradient = ctx.createRadialGradient(p_canvas.get_x(), p_canvas.get_y(), 0, p_canvas.get_x(), p_canvas.get_y(), r_canvas);
            gradient.addColorStop(0, DRAW_ZONE_CENTER_COLOR);
            gradient.addColorStop(1, DRAW_ZONE_BORDER_COLOR);
            ctx.fillStyle = gradient;
            ctx.strokeStyle = DRAW_ZONE_OUTER_STROKE_COLOR;
            ctx.lineWidth = DRAW_ZONE_OUTER_STROKE_SIZE;
            ctx.beginPath();
            ctx.arc(p_canvas.get_x(), p_canvas.get_y(), r_canvas, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            const is_selected = this.selected_indices.includes(i + start_vertex_index) && !ignore_selection;
            ctx.fillStyle = is_selected ? DRAW_SELECTED_VERTEX_COLOR : DRAW_LINE_COLOR;
            ctx.beginPath();
            ctx.arc(p_canvas.get_x(), p_canvas.get_y(), DRAW_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();

            // also the label
            ctx.font = "bold " + DRAW_POINT_LABEL_SIZE.toString() + "px" + " " + DRAW_POINT_LABEL_FONT;
            ctx.fillStyle = DRAW_POINT_LABEL_COLOR;
            ctx.textBaseline = "middle";
            ctx.fillText(i.toString(), p_canvas.get_x() + 8, p_canvas.get_y());
        }

        start_vertex_index += room_zones.length;

        // connections
        const room_connections = this.room.get_connections();
        // at first draw all finished connections
        for (let i = 0; i < room_connections.length; i++) {
            const connection = room_connections[i];
            const s_canvas = tfm.apply(connection.get_start());
            const e_canvas = tfm.apply(connection.get_end());

            const is_selected = this.selected_indices.includes(i + start_vertex_index) && !ignore_selection;
            ctx.strokeStyle = is_selected ? DRAW_SELECTED_VERTEX_COLOR : DRAW_CONNECTION_COLOR;
            ctx.lineWidth = DRAW_CONNECTION_STROKE_SIZE;
            ctx.beginPath();
            ctx.moveTo(s_canvas.get_x(), s_canvas.get_y());
            ctx.lineTo(e_canvas.get_x(), e_canvas.get_y());
            ctx.stroke();

            // and also points
            ctx.fillStyle = is_selected ? DRAW_SELECTED_VERTEX_COLOR : DRAW_CONNECTION_COLOR;
            ctx.beginPath();
            ctx.arc(s_canvas.get_x(), s_canvas.get_y(), DRAW_CONNECTION_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(e_canvas.get_x(), e_canvas.get_y(), DRAW_CONNECTION_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();
        }

        // then for the last point
        const room_constructed_connection = this.room.get_constructed_connection();
        if (room_constructed_connection.length > 0) {
            const p = room_constructed_connection[room_constructed_connection.length - 1];
            const p_canvas = tfm.apply(p);

            if (this.potential_point_do_add) {
                const add_canvas = tfm.apply(this.potential_point_do_add);
                ctx.strokeStyle = DRAW_CONNECTION_COLOR;
                ctx.lineWidth = DRAW_CONNECTION_STROKE_SIZE;
                ctx.beginPath();
                ctx.moveTo(p_canvas.get_x(), p_canvas.get_y());
                ctx.lineTo(add_canvas.get_x(), add_canvas.get_y());
                ctx.stroke();   
            }

            ctx.fillStyle = DRAW_CONNECTION_COLOR;
            ctx.beginPath();
            ctx.arc(p_canvas.get_x(), p_canvas.get_y(), DRAW_CONNECTION_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();
        }

        start_vertex_index += room_connections.length;
        // doors
        const room_doors = this.room.get_doors();
        for (let i = 0; i < room_doors.length; i++) {
            const door = room_doors[i];
            // we should find two points
            // intersection of the door line with cycles
            const start_t = door.get_negative_intersection(closed_cycles);
            const end_t = door.get_positive_intersection(closed_cycles);  // here we get positive parameter but for negate direction
            if (start_t >= Number.MAX_VALUE || end_t >= Number.MAX_VALUE) {
                continue;
            }

            const center = door.get_center();
            const center_canvas = tfm.apply(center);

            const is_selected = this.selected_indices.includes(i + start_vertex_index) && !ignore_selection;
            ctx.strokeStyle = is_selected ? DRAW_SELECTED_VERTEX_COLOR : DRAW_DOOR_COLOR;
            ctx.lineWidth = DRAW_DOOR_LINE_SIZE;
            ctx.beginPath();
            
            const s = tfm.apply(door.get_point(-start_t));
            const e = tfm.apply(door.get_point(end_t));

            ctx.moveTo(s.get_x(), s.get_y());
            ctx.lineTo(e.get_x(), e.get_y());
            ctx.stroke();

            // center point
            ctx.fillStyle = is_selected ? DRAW_SELECTED_VERTEX_COLOR : DRAW_DOOR_COLOR;
            ctx.beginPath();
            ctx.arc(center_canvas.get_x(), center_canvas.get_y(), DRAW_DOOR_POINT_SIZE, 0, 2 * Math.PI, false);
            ctx.fill();
        }
    }

    update() {
        this.context.clearRect(0, 0, this.width, this.height);

        this.draw(this.context, this.world_to_canvas_tfm, false);
    }
}