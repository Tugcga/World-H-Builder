import { AABB } from "../math/aabb";
import { Connection } from "../math/connection";
import { Door } from "../math/door";
import { is_point_inside_edge } from "../math/path_utilities";
import { Point } from "../math/point";
import { angle_between_vectors, vector2_add, vector2_distance, vector2_normalise, vector2_subtract, Vector2D } from "../math/vector";
import { Zone } from "../math/zone";
import { ItemStepType, RoomConstructDirection, RoomConstructMode, Tool } from "./types";

function get_edge_with_point(cycle: Array<Vector2D>, point: Vector2D): number {
    for (let i = 0; i < cycle.length; i++) {
        const start = cycle[i];
        const end = cycle[(i + 1) % cycle.length];
        if (is_point_inside_edge(start, end, point, true)) {
            return i;
        }
    }

    return -1;
}

function are_points_on_the_same_edge(cycle: Array<Vector2D>, a: Vector2D, b: Vector2D): boolean {
    // path is the closed path
    for (let i = 0; i < cycle.length; i++) {
        const start = cycle[i];
        const end = cycle[(i + 1) % cycle.length];
        if (is_point_inside_edge(start, end, a, true) && is_point_inside_edge(start, end, b, true)) {
            return true;
        }
    }

    return false;
}

function is_point_inside_path(path: Array<Vector2D>, point: Vector2D, allow_vertex: boolean = false, consider_closed: boolean = false, e: number = 0.0001): boolean {
    // if consider_closed = true then also check the last edge from end to start
    if (path.length == 0) {
        return false;
    }

    if (path.length == 1) {
        if (allow_vertex) {
            const a = path[0];
            if (a.is_coincide(point)) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }
    for (let i = 0; i < path.length - 1; i++) {
        const a: Vector2D = path[i];
        const b: Vector2D = path[i + 1];

        if (is_point_inside_edge(a, b, point, allow_vertex, e)) {
            return true;
        }
    }

    if (consider_closed) {
        const a = path[path.length - 1];
        const b = path[0];
        if (is_point_inside_edge(a, b, point, allow_vertex, e)) {
            return true;
        }
    }

    return false;
}

function is_edge_intersects(a: Vector2D, b: Vector2D, s: Vector2D, e: Vector2D): boolean {
    // return true if edges AB and SE are intersects

    // calculate oriented area for two vectors: AB, AS and AB, AE
    const a_0 = (b.get_x() - a.get_x()) * (s.get_y() - a.get_y()) - (b.get_y() - a.get_y()) * (s.get_x() - a.get_x());
    const a_1 = (b.get_x() - a.get_x()) * (e.get_y() - a.get_y()) - (b.get_y() - a.get_y()) * (e.get_x() - a.get_x());

    // simillary for SE with SA and SB
    const a_2 = (e.get_x() - s.get_x()) * (a.get_y() - s.get_y()) - (e.get_y() - s.get_y()) * (a.get_x() - s.get_x());
    const a_3 = (e.get_x() - s.get_x()) * (b.get_y() - s.get_y()) - (e.get_y() - s.get_y()) * (b.get_x() - s.get_x());

    if (a_0 * a_1 < 0 && a_2 * a_3 <= 0) {
        return true;
    }

    return false;
}

function path_orientation(path: Array<Vector2D>): number {
    // return winding number of the path
    let angle = 0.0;
    // we should calculate the sum of angles between ech pair of consequence edges of the path
    // the path is assumed to be closed
    for (let i = 0; i < path.length; i++) {
        // i - the index of the edge
        // i + 1 - the index of the next edge

        const a_start = path[i];
        const a_end = path[(i + 1) % path.length];
        const a = new Vector2D(a_end.get_x() - a_start.get_x(), a_end.get_y() - a_start.get_y());

        const b_start = path[(i + 1) % path.length];
        const b_end = path[(i + 2) % path.length];
        const b = new Vector2D(b_end.get_x() - b_start.get_x(), b_end.get_y() - b_start.get_y());

        angle += angle_between_vectors(a, b);
    }

    return angle;
}

function is_edge_intersect_path(path: Array<Vector2D>, start: Vector2D, end: Vector2D, is_cycle: boolean): boolean {
    // we consider each edge in the path
    if (path.length <= 1) {
        return false;
    }

    for (let i = 0; i < (is_cycle ? path.length : (path.length - 1)); i++) {
        const a = path[i];
        const b = path[(i + 1) % path.length];

        if (is_edge_intersects(a, b, start, end)) {
            return true;
        }
    }

    return false;
}

function get_edge_index_with_point(path: Array<Vector2D>, point: Vector2D, consider_closed: boolean = false, e: number = 0.0001): number {
    // return the index of the edge (measured as the first edge vertex) in the path, which contains the input point
    // if point does not match with any inner point, then return the index of the last point
    if (path.length >= 2) {
        for (let i = 0; i < (consider_closed ? path.length : (path.length - 1)); i++) {
            const a = path[i];
            const b = path[(i + 1) % path.length];

            // again, detect are AP and AB are collinear, by using oriented area
            const area = (point.get_x() - a.get_x()) * (b.get_y() - a.get_y()) - (point.get_y() - a.get_y()) * (b.get_x() - a.get_x());
            if (Math.abs(area) < e) {
                // check are point coordinates between min and max coordinated of A and B
                if (Math.min(a.get_x(), b.get_x()) <= point.get_x() &&
                    Math.max(a.get_x(), b.get_x()) >= point.get_x() &&
                    Math.min(a.get_y(), b.get_y()) <= point.get_y() &&
                    Math.max(a.get_y(), b.get_y()) >= point.get_y()) {
                    return i;
                }
            }
        }
    }

    return -1;
}

function total_cycle_angle(cycle: Array<Vector2D>, point: Vector2D): number {
    let angle = 0.0;
    for (let i = 0; i < cycle.length; i++) {
        const a_end = cycle[i];
        const b_end = cycle[(i + 1) % cycle.length];
        const a = new Vector2D(a_end.get_x() - point.get_x(), a_end.get_y() - point.get_y());
        const b = new Vector2D(b_end.get_x() - point.get_x(), b_end.get_y() - point.get_y());

        angle += angle_between_vectors(a, b);
    }

    return angle;
}

function is_match_vertex(cycle: Array<Vector2D>, point: Vector2D): boolean {
    for (let i = 0; i < cycle.length; i++) {
        if (cycle[i].is_coincide(point)) {
            return true;
        }
    }

    return false;
}

function is_point_inside(cycle: Array<Vector2D>, point: Vector2D): boolean {
    // first check that point not in the vertex
    // in the same loop calculate minimum x-coordinate
    if (is_match_vertex(cycle, point)) {
        return false;
    }

    // we should calculate the total winding angle for all cycle vertices from a given point
    // if it equal to 2*PI, then we inside, if 0.0 - outside
    // NOTE: if the cycle oriented on other direction, then the total angle may be not 2*PI, but -2*PI
    const angle = Math.abs(total_cycle_angle(cycle, point));
    return Math.abs(angle - 2 * Math.PI) < 0.001;
}

function is_point_outside(cycle: Array<Vector2D>, point: Vector2D): boolean {
    // simillary
    if (is_match_vertex(cycle, point)) {
        return false;
    }

    const angle = total_cycle_angle(cycle, point);
    return Math.abs(angle) < 0.001;
}

function is_path_combination_valid(closed_cycles: Array<Array<Vector2D>>, last_path: Array<Vector2D>,
    points: Array<Point>,
    zones: Array<Zone>,
    connections: Array<Connection>,
    doors: Array<Door>,
    check_orientations: boolean = false): boolean {
    // return true if input combination of cycles and path is valid
    // it means that no edge intersections, no point on another edge, all non-first closed are inside first closed
    // and last also inside first
    // TODO: check that new paths does not contains points, zones and may be proper with respect to connection edges
    for (let i = 0; i < closed_cycles.length; i++) {
        const cycle = closed_cycles[i];
        for (let j = 0; j < cycle.length; j++) {
            const a = cycle[j];
            const b = cycle[(j + 1) % cycle.length];

            for (let k = 0; k < closed_cycles.length; k++) {
                // we enumerate all close cycles
                // if the edge corresponds to the same cycle, consider edge-by-edge comparison
                const check_cycle = closed_cycles[k];
                if (k == i) {
                    for (let s = 0; s < check_cycle.length; s++) {
                        if (s == j) {
                            continue;
                        }
                        const check_a = check_cycle[s];
                        const check_b = check_cycle[(s + 1) % check_cycle.length];
                        if (is_edge_intersects(a, b, check_a, check_b)) {
                            return false;
                        }
                    }
                } else {
                    // if cycles are different - consider edge-to-cycle check
                    if (is_edge_intersect_path(check_cycle, a, b, true)) {
                        return false;
                    }
                }
            }
            if (is_edge_intersect_path(last_path, a, b, false)) {
                return false;
            }
        }
    }

    // simillary for the last path
    for (let i = 0; i < last_path.length - 1; i++) {
        const a = last_path[i];
        const b = last_path[i + 1];

        for (let j = 0; j < closed_cycles.length; j++) {
            const cycle = closed_cycles[j];
            if (is_edge_intersect_path(cycle, a, b, true)) {
                return false;
            }
        }
        // and with edges of the last path
        for (let k = 0; k < last_path.length - 1; k++) {
            if (k == i) {
                continue;
            }

            const check_a = last_path[k];
            const check_b = last_path[k + 1];
            if (is_edge_intersects(a, b, check_a, check_b)) {
                return false;
            }
        }
    }

    // and also no point of the last path placed on the last path edge
    for (let i = 0; i < last_path.length; i++) {
        for (let j = 0; j < last_path.length - 1; j++) {
            if (i == j || i - 1 == j) {
                continue;
            }
            const a = last_path[j];
            const b = last_path[j + 1];
            // also check that vertices are coincide
            if (last_path[i].is_coincide(a) || last_path[i].is_coincide(b)) {
                return false;
            }

            if (is_point_inside_edge(a, b, last_path[i], false)) {
                return false;
            }
        }
    }

    // next we should check that each vertex from non-first closed cycle is inside the first one
    if (closed_cycles.length >= 1) {
        const first_cycle = closed_cycles[0];

        // all other should be inside this cycle
        for (let i = 1; i < closed_cycles.length; i++) {
            const cycle = closed_cycles[i];
            for (let j = 0; j < cycle.length; j++) {
                if (!is_point_inside(first_cycle, cycle[j])) {
                    return false;
                }
            }

            // also check that all vertices from another paths are outside of this cycle
            for (let j = 0; j < closed_cycles.length; j++) {
                if (i == j) {
                    continue;
                }
                const target_cycle = closed_cycles[j];
                for (let k = 0; k < target_cycle.length; k++) {
                    if (!is_point_outside(cycle, target_cycle[k])) {
                        return false;
                    }
                }
            }
            // and last path
            for (let j = 0; j < last_path.length; j++) {
                if (!is_point_outside(cycle, last_path[j])) {
                    return false;
                }
            }
        }
        for (let i = 0; i < last_path.length; i++) {
            if (!is_point_inside(first_cycle, last_path[i])) {
                return false;
            }
        }
    }

    // and also check orientations, if required
    if (check_orientations) {
        if (closed_cycles.length >= 1) {
            const first_cycle = closed_cycles[0];
            const winding_angle = path_orientation(first_cycle);
            if (winding_angle < 0.0) {
                return false;
            }

            for (let i = 1; i < closed_cycles.length; i++) {
                const cycle = closed_cycles[i];
                const secondary_winding_angle = path_orientation(cycle);
                if (secondary_winding_angle > 0.0) {
                    return false;
                }
            }
        }
    }

    // check connections
    if (closed_cycles.length == 0) {
        return true;
    }
    const cycle = closed_cycles[0];
    for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        if (!are_points_on_the_same_edge(cycle, c.get_start(), c.get_end())) {
            return false;
        }
    }

    // connections should not be overlapped
    for (let i = 0; i < connections.length - 1; i++) {
        const c_i = connections[i];
        for (let j = i + 1; j < connections.length; j++) {
            const c_j = connections[j];
            if (c_j.is_overlap(c_i.get_start(), c_i.get_end())) {
                return false;
            }
        }
    }

    // all points, zones and doors should contains inside the first cycle
    // and outside of other ones
    if (closed_cycles.length == 0) {
        return false;
    }
    const first_cycle = closed_cycles[0];
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (!is_point_inside(first_cycle, point.get_position())) {
            return false;
        }
        for (let j = 1; j < closed_cycles.length; j++) {
            if (!is_point_outside(closed_cycles[j], point.get_position())) {
                return false;
            }
        }
    }
    for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        if (!is_point_inside(first_cycle, zone.get_position())) {
            return false;
        }
        for (let j = 1; j < closed_cycles.length; j++) {
            if (!is_point_outside(closed_cycles[j], zone.get_position())) {
                return false;
            }
        }
    }

    for (let i = 0; i < doors.length; i++) {
        const door = doors[i];
        if (!is_point_inside(first_cycle, door.get_center())) {
            return false;
        }
        for (let j = 1; j < closed_cycles.length; j++) {
            if (!is_point_outside(closed_cycles[j], door.get_center())) {
                return false;
            }
        }
    }

    // all center should be different
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            if (points[i].get_position().is_coincide(points[j].get_position())) {
                return false;
            }
        }

        for (let j = 0; j < zones.length; j++) {
            if (points[i].get_position().is_coincide(zones[j].get_position())) {
                return false;
            }
        }
    }

    for (let i = 0; i < zones.length - 1; i++) {
        for (let j = i + 1; j < zones.length; j++) {
            if (zones[i].get_position().is_coincide(zones[j].get_position())) {
                return false;
            }
        }
    }

    return true;
}


export class RoomConstructor {
    private id: number;
    private constructed_cycle: Array<Vector2D> = new Array<Vector2D>();
    private draw_mode: RoomConstructMode = RoomConstructMode.None;
    private direction_mode: RoomConstructDirection = RoomConstructDirection.Tail;

    // store last point we check as valid new point
    // these values should be reset when we change the geometry (move, delete points or add points)
    private last_check_point: Vector2D | null = null;
    private last_check_tool: Tool | null = null;
    private last_check_result: boolean = false;

    // store here closed cycles
    // the first one should be oriented in counter clockwise direction
    // all other - in clockwise direction
    // first cycle - is the room outer boundary, all other - inner obstacles
    private closed_cycles: Array<Array<Vector2D>> = new Array<Array<Vector2D>>();

    private points: Array<Point> = new Array<Point>();
    private click_point_index: number = -1;
    private zones: Array<Zone> = new Array<Zone>();
    private click_zone_index: number = -1;
    private connections: Array<Connection> = new Array<Connection>();
    private constructed_connection: Array<Vector2D> = new Array<Vector2D>();
    private doors: Array<Door> = new Array<Door>();
    private click_door_index: number = -1;

    constructor(in_id: number) {
        this.id = in_id;
    }

    get_id(): number {
        return this.id;
    }

    get_points(): Array<Point> {
        return this.points;
    }

    get_zones(): Array<Zone> {
        return this.zones;
    }

    get_connections(): Array<Connection> {
        return this.connections;
    }

    get_constructed_connection(): Array<Vector2D> {
        return this.constructed_connection;
    }

    get_doors(): Array<Door> {
        return this.doors;
    }

    get_selected_indices(aabb: AABB): Array<number> {
        // indices we count in all built cycles
        // sum all vertices in closed cycles and then from constructed cycle

        // return path indices, which contained in the bb
        const to_return = new Array<number>();

        // at first check vertices from built cycles
        let vertex_index = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            const cycle = this.closed_cycles[i];
            for (let j = 0; j < cycle.length; j++) {
                const p = cycle[j];
                if (aabb.is_contain(p)) {
                    to_return.push(vertex_index);
                }
                vertex_index += 1;
            }
        }
        
        // and then constructed cycle
        for (let i = 0; i < this.constructed_cycle.length; i++) {
            const p = this.constructed_cycle[i];
            if (aabb.is_contain(p)) {
                to_return.push(vertex_index);
            }
            vertex_index += 1;
        }

        // points
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (aabb.is_contain(p.get_position())) {
                to_return.push(vertex_index);
            }
            vertex_index += 1;
        }

        // zones
        for (let i = 0; i < this.zones.length; i++) {
            const p = this.zones[i];
            if (aabb.is_contain(p.get_position())) {
                to_return.push(vertex_index);
            }
            vertex_index += 1;
        }

        // connections
        for (let i = 0; i < this.connections.length; i++) {
            const c = this.connections[i];
            if (aabb.is_contain(c.get_start()) || aabb.is_contain(c.get_end())) {
                to_return.push(vertex_index);
            }
            vertex_index += 1;
        }

        // doors
        for (let i = 0; i < this.doors.length; i++) {
            const d = this.doors[i];
            if (aabb.is_contain(d.get_center())) {
                to_return.push(vertex_index);
            }
            vertex_index += 1;
        }

        return to_return;
    }

    get_closed_cycles(): Array<Array<Vector2D>> {
        return this.closed_cycles;
    }

    get_constructed_cycle(): Array<Vector2D> {
        return this.constructed_cycle;
    }

    is_valid_point(in_pos: Vector2D, active_tool: Tool, use_cache: boolean = true): boolean {
        // try to use cached value
        if (this.last_check_tool && this.last_check_tool != active_tool) {
            this.last_check_tool = null;
        }

        if (this.last_check_point && this.last_check_tool && this.last_check_point.is_coincide(in_pos)) {
            if (use_cache) {
                return this.last_check_result;
            }
        }

        // cache checking result
        const is_valid = this._is_valid_point_process(in_pos, active_tool);
        this.last_check_point = in_pos.clone();
        this.last_check_result = is_valid;
        this.last_check_tool = active_tool;

        return is_valid;
    }

    private _is_valid_point_process(in_pos: Vector2D, active_tool: Tool): boolean {
        if (active_tool == Tool.WallDraw) {
            // here we check is the input point can be added to some path
            // here we consider several cases
            // is the mode is none, then it differs is there is the first closed cycle or not
            // if the mode is Draw, then we extend constructed cycle only
            if (this.draw_mode == RoomConstructMode.None) {
                // in this case we can
                // - start new current cycle
                // - start continue current cycle
                // - split an edge

                if (this.constructed_cycle.length > 0) {
                    // there are point in the current cycle
                    if (this.constructed_cycle[0].is_coincide(in_pos) || this.constructed_cycle[this.constructed_cycle.length - 1].is_coincide(in_pos)) {
                        // and we click at the start or end
                        return true;
                    }
                }

                // if in_pos inside edge of the connection - return false
                for (let i = 0; i < this.connections.length; i++) {
                    const c = this.connections[i];
                    if (c.is_point_inside(in_pos)) {
                        return false;
                    }
                } 

                // may be we would like to click at the edge
                // check all cycles
                for (let i = 0; i < this.closed_cycles.length; i++) {
                    const cycle = this.closed_cycles[i];
                    if (is_point_inside_path(cycle, in_pos, false, true)) {
                        return true;
                    }
                }
                // also current cycle
                if (is_point_inside_path(this.constructed_cycle, in_pos, false, false)) {
                    return true;
                }

                // may be the current cycle is empty and we would like to start define it
                if (this.constructed_cycle.length == 0) {
                    // we can click only inside first closed cycle and outside of all other closed cycles
                    if (this.closed_cycles.length >= 1) {
                        // there are closed cycles
                        if (is_point_inside(this.closed_cycles[0], in_pos)) {
                            //check other closed cycles
                            for (let i = 1; i < this.closed_cycles.length; i++) {
                                if (!is_point_outside(this.closed_cycles[i], in_pos)) {
                                    return false;
                                }
                            }
                            return true;
                        }
                        return false;
                    } else {
                        // no closed cycles
                        // any point is valid
                        return true;
                    }
                }
            } else if (this.draw_mode == RoomConstructMode.DrawWalls) {
                // here we would like to add new point to the constructed cycle
                // new edge can close the current cycle
                // or it should not add intersections with already existed edges
                if ((this.direction_mode == RoomConstructDirection.Tail && this.constructed_cycle[0].is_coincide(in_pos)) ||
                    (this.direction_mode == RoomConstructDirection.Head && this.constructed_cycle[this.constructed_cycle.length - 1].is_coincide(in_pos))) {
                    // in tail mode we would like to click to the first vertex
                    // ot in head mode - to the last vertex
                    // both cases are allowed, because it will close the cycle
                    return true;
                }
                
                // check that potential point not inside any edge
                for (let i = 0; i < this.closed_cycles.length; i++) {
                    const cycle = this.closed_cycles[i];
                    if (is_point_inside_path(cycle, in_pos, true, true)) {
                        return false;
                    }
                }
                // and also for the current constructed cycle
                if (is_point_inside_path(this.constructed_cycle, in_pos, true)) {
                    return false;
                }

                // additionally we should check that new edge from last point to the current does not intersect edges of the path
                const last_point = this.constructed_cycle[this.direction_mode == RoomConstructDirection.Head ? 0 : (this.constructed_cycle.length - 1)];
                // again, check intersections with each path
                for (let i = 0; i < this.closed_cycles.length; i++) {
                    const cycle = this.closed_cycles[i];
                    if (is_edge_intersect_path(cycle, last_point, in_pos, true)) {
                        return false;
                    }
                }
                if (is_edge_intersect_path(this.constructed_cycle, last_point, in_pos, false)) {
                    return false;
                }

                return true;
            }
        } else if (active_tool == Tool.PointDraw || active_tool == Tool.ZoneDraw || active_tool == Tool.DoorDraw) {
            // points, zones and doors can be placed in the same points
            // point slot we can define only inside already created outer cycle
            // and this point should not be contained inside cycle edges
            if (this.closed_cycles.length > 0) {
                if (is_point_inside(this.closed_cycles[0], in_pos)) {
                    for (let i = 1; i < this.closed_cycles.length; i++) {
                        if (!is_point_outside(this.closed_cycles[i], in_pos)) {
                            return false;
                        }
                    }

                    // check that this point does not coincide with already existed one
                    if (active_tool == Tool.PointDraw) {
                        // different arrays for different tools
                        for (let i = 0; i < this.points.length; i++) {
                            if (this.points[i].get_position().is_coincide(in_pos)) {
                                return false;
                            }
                        }
                        return true;
                    } else if (active_tool == Tool.ZoneDraw) {
                        for (let i = 0; i < this.zones.length; i++) {
                            if (this.zones[i].get_position().is_coincide(in_pos)) {
                                return false;
                            }
                        }
                        return true;
                    } else if (active_tool == Tool.DoorDraw) {
                        // for doors no additional checks
                        // doors can intersects, has the same center and so on
                        return true;
                    }
                }
            }
        } else if (active_tool == Tool.ConnectionDraw) {
            // for connection draw tool valid position is the position on the outer edge
            if (this.closed_cycles.length > 0) {
                // this point should not be inside already created connections
                for (let i = 0; i < this.connections.length; i++) {
                    if (this.connections[i].is_point_inside(in_pos)) {
                        return false;
                    }
                }
                if (this.constructed_connection.length > 0 && 
                    this.constructed_connection[this.constructed_connection.length - 1].is_coincide(in_pos)) {
                    // connection can not be zero size
                    return false;
                }
                if (is_point_inside_path(this.closed_cycles[0], in_pos, true, true)) {
                    // if thi point should be the first point of the pair - then it allows
                    if (this.constructed_connection.length == 0) {
                        return true;
                    } else {
                        // but if this should be the second point in the connection pair - 
                        // then check that this vertex corresponds to the same edge in the outer cycle
                        const prev_point = this.constructed_connection.at(-1);
                        if (prev_point && are_points_on_the_same_edge(this.closed_cycles[0], prev_point, in_pos)) {
                            // check may be new created connection will be overlapped with existed one
                            for (let i = 0; i < this.connections.length; i++) {
                                if (this.connections[i].is_overlap(prev_point, in_pos)) {
                                    return false;
                                }
                            }
                            return true;
                        } else {
                            return false;
                        }
                    }
                }
            }
        }
        
        return false;
    }

    reset_connection_draw(): boolean {
        // return true if we actually reset the first connection point
        const to_return = this.constructed_connection.length > 0;
        this.constructed_connection.length = 0;

        return to_return;
    }

    remove_connection_at_point(point: Vector2D): boolean {
        // remove true if we actually remove something
        for (let i = this.connections.length - 1; i >= 0; i--) {
            const c = this.connections[i];

            if (c.is_in_neighbourhood(point)) {
                this.connections.splice(i, 1);

                // we assume here that we can remove only one connection
                // because all of them are not overlapped
                return true;
            }
        }

        return false;
    }

    get_index_at_point(point: Vector2D, delta: number = 0.1): number {
        // return index of the vertex, if the point coincide with it
        // indexes are counted for all cycles
        // start from closed, and finish by current unclosed
        const delta_square = delta * delta;

        let vertex_index = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            const cycle = this.closed_cycles[i];
            for (let j = 0; j < cycle.length; j++) {
                const vertex = cycle[j];
                const d_square = (point.get_x() - vertex.get_x()) * (point.get_x() - vertex.get_x()) + (point.get_y() - vertex.get_y()) * (point.get_y() - vertex.get_y());
                if (d_square < delta_square) {
                    return vertex_index;
                }
                vertex_index += 1;
            }
        }
        // the same for current cycle
        for (let j = 0; j < this.constructed_cycle.length; j++) {
            const vertex = this.constructed_cycle[j];
            const d_square = (point.get_x() - vertex.get_x()) * (point.get_x() - vertex.get_x()) + (point.get_y() - vertex.get_y()) * (point.get_y() - vertex.get_y());
            if (d_square < delta_square) {
                return vertex_index;
            }
            vertex_index += 1;
        }

        for (let k = 0; k < this.points.length; k++) {
            const vertex = this.points[k];
            const d_square = (point.get_x() - vertex.get_position().get_x()) * (point.get_x() - vertex.get_position().get_x()) + (point.get_y() - vertex.get_position().get_y()) * (point.get_y() - vertex.get_position().get_y());
            if (d_square < delta_square) {
                return vertex_index;
            }
            vertex_index += 1;
        }

        for (let l = 0; l < this.zones.length; l++) {
            const vertex = this.zones[l];
            const d_square = (point.get_x() - vertex.get_position().get_x()) * (point.get_x() - vertex.get_position().get_x()) + (point.get_y() - vertex.get_position().get_y()) * (point.get_y() - vertex.get_position().get_y());
            if (d_square < delta_square) {
                return vertex_index;
            }
            vertex_index += 1;
        }

        for (let m = 0; m < this.connections.length; m++) {
            const c = this.connections[m];
            if (c.is_in_neighbourhood(point, delta)) {
                return vertex_index;
            }

            vertex_index += 1;
        }

        for (let n = 0; n < this.doors.length; n++) {
            const vertex = this.doors[n];
            const d_square = (point.get_x() - vertex.get_center().get_x()) * (point.get_x() - vertex.get_center().get_x()) + (point.get_y() - vertex.get_center().get_y()) * (point.get_y() - vertex.get_center().get_y());
            if (d_square < delta_square) {
                return vertex_index;
            }
            vertex_index += 1;
        }

        return -1;
    }

    private _split_edge(in_point: Vector2D): boolean {
        // return true if we make the split
        this.draw_mode = RoomConstructMode.None;
        // iterate throw all paths, not only the current one
        for (let i = 0; i < this.closed_cycles.length; i++) {
            const cycle = this.closed_cycles[i];
            const edge_index = get_edge_index_with_point(cycle, in_point, true);
            if (edge_index >= 0 && !cycle[edge_index].is_coincide(in_point) && !cycle[(edge_index + 1) % cycle.length].is_coincide(in_point)) {
                cycle.splice(edge_index + 1, 0, in_point);
                // make one split and finish
                return true;
            }
        }
        // current constructed path is never close
        const current_edge_index = get_edge_index_with_point(this.constructed_cycle, in_point, false);
        if (current_edge_index >= 0 && !this.constructed_cycle[current_edge_index].is_coincide(in_point) && !this.constructed_cycle[(current_edge_index + 1) % this.constructed_cycle.length].is_coincide(in_point)) {
            this.constructed_cycle.splice(current_edge_index + 1, 0, in_point);
            return true;
        }

        return false;
    }

    _close_current() {
        const winding_angle = path_orientation(this.constructed_cycle);
        // for first closed cycle it should be positive, for other - negative
        const should_revert = this.closed_cycles.length == 0 ? (winding_angle < 0.0) : (winding_angle > 0.0);
        const new_cycle = new Array<Vector2D>();
        for (let i = 0; i < this.constructed_cycle.length; i++) {
            new_cycle.push(should_revert ? this.constructed_cycle[this.constructed_cycle.length - 1 - i] : this.constructed_cycle[i]);
        }

        this.closed_cycles.push(new_cycle);
        this.constructed_cycle.length = 0;
        this.draw_mode = RoomConstructMode.None;

        this._filter_points();
        this._filter_zones();
        this._filter_connections();
        this._filter_doors();
    }

    reset_click_point() {
        this.click_point_index = -1;
    }

    reset_click_zone() {
        this.click_zone_index = -1;
    }

    reset_click_door() {
        this.click_door_index = -1;
    }

    _filter_points() {
        for (let i = this.points.length - 1; i >= 0; i--) {
            const point_position = this.points[i].get_position();
            if (this.closed_cycles.length > 0 && !is_point_inside(this.closed_cycles[0], point_position)) {
                this.points.splice(i, 1);
            } else {
                for (let j = 1; j < this.closed_cycles.length; j++) {
                    if (is_point_inside(this.closed_cycles[j], point_position)) {
                        this.points.splice(i, 1);
                    }
                }
            }
        }
    }

    _filter_zones() {
        for (let i = this.zones.length - 1; i >= 0; i--) {
            const zone_position = this.zones[i].get_position();
            if (this.closed_cycles.length > 0 && !is_point_inside(this.closed_cycles[0], zone_position)) {
                this.zones.splice(i, 1);
            } else {
                for (let j = 1; j < this.closed_cycles.length; j++) {
                    if (is_point_inside(this.closed_cycles[j], zone_position)) {
                        this.zones.splice(i, 1);
                    }
                }
            }
        }
    }

    _filter_connections() {
        for (let i = this.connections.length - 1; i >= 0; i--) {
            const c = this.connections[i];
            if (this.closed_cycles.length == 0) {
                this.connections.splice(i, 1);
            } else {
                const cycle = this.closed_cycles[0];
                if (!are_points_on_the_same_edge(cycle, c.get_start(), c.get_end())) {
                    this.connections.splice(i, 1);
                }
            }
        }
    }

    _filter_doors() {
        for (let i = this.doors.length - 1; i >= 0; i--) {
            const door_center = this.doors[i].get_center();
            if (this.closed_cycles.length > 0 && !is_point_inside(this.closed_cycles[0], door_center)) {
                this.doors.splice(i, 1);
            } else {
                for (let j = 1; j < this.closed_cycles.length; j++) {
                    if (is_point_inside(this.closed_cycles[j], door_center)) {
                        this.doors.splice(i, 1);
                    }
                }
            }
        }
    }

    add_points(in_points: Array<Point>) {
        for (let i = 0; i < in_points.length; i++) {
            this.points.push(in_points[i].clone());
        }
    }

    add_zones(in_zones: Array<Zone>) {
        for (let i = 0; i < in_zones.length; i++) {
            this.zones.push(in_zones[i].clone());
        }
    }

    add_connections(in_connections: Array<Connection>) {
        for (let i = 0; i < in_connections.length; i++) {
            this.connections.push(in_connections[i].clone());
        }
    }

    add_doors(in_doors: Array<Door>) {
        for (let i = 0; i < in_doors.length; i++) {
            this.doors.push(in_doors[i].clone());
        }
    }

    add_point_point(in_point: Vector2D) {
        // we already check that input point is valid
        this.points.push(new Point(in_point, 0));

        this.last_check_point = null;
        this.last_check_tool = null;

        this.click_point_index = this.points.length - 1;
    }

    add_zone_point(in_point: Vector2D) {
        this.zones.push(new Zone(in_point, 0.0));
        this.last_check_point = null;
        this.last_check_tool = null;

        this.click_zone_index = this.zones.length - 1;
    }

    add_door_center(in_point: Vector2D) {
        this.doors.push(new Door(in_point, 0.0));
        this.last_check_point = null;
        this.last_check_tool = null;

        this.click_door_index = this.doors.length - 1;
    }

    define_click_point_angle(target_point: Vector2D) {
        if (this.click_point_index >= 0 && this.click_point_index < this.points.length) {
            const to_vector = vector2_normalise(vector2_subtract(target_point, this.points[this.click_point_index].get_position()));
            if (to_vector.length() > 0.5) {
                let angle = -Math.atan2(to_vector.get_y(), to_vector.get_x());
                if (angle < 0) {
                    angle += 2 * Math.PI;
                }

                const step = (2 * Math.PI) / 16;
                const idx = Math.round(angle / step) % 16;
                this.points[this.click_point_index].set_angle(idx * step);
            }
        }
    }

    define_click_zone_radius(target_point: Vector2D) {
        if (this.click_zone_index >= 0 && this.click_zone_index < this.zones.length) {
            // calculate distance between click zon position and target point
            const radius = vector2_distance(this.zones[this.click_zone_index].get_position(), target_point);
            // snap radius to value
            this.zones[this.click_zone_index].set_radius(
                Math.round(radius / 0.5) * 0.5);
        }
    }

    define_click_door_direction(target_point: Vector2D) {
        if (this.click_door_index >= 0 && this.click_door_index < this.doors.length) {
            const to_vector = vector2_normalise(vector2_subtract(target_point, this.doors[this.click_door_index].get_center()));
            if (to_vector.length() > 0.5) {
                let angle = -Math.atan2(to_vector.get_y(), to_vector.get_x());
                if (angle < 0) {
                    angle += 2 * Math.PI;
                }
                // set angle without any snap
                this.doors[this.click_door_index].set_angle(angle);
            }
        }
    }

    convert_index_to_wall_index(in_index: number): number {
        let walls_vertex_count = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            walls_vertex_count += this.closed_cycles[i].length;
        }
        walls_vertex_count += this.constructed_cycle.length;
        if (in_index >= 0 && in_index < walls_vertex_count) {
            return in_index;
        }
        return -1;
    }

    convert_index_to_point_index(in_index: number): number {
        // input is index in total order with wall vertices
        // return index in points array, if it is the point
        let vertex_shift = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            vertex_shift += this.closed_cycles[i].length;
        }
        vertex_shift += this.constructed_cycle.length;
        if (in_index >= vertex_shift && in_index < vertex_shift + this.points.length) {
            this.click_point_index = in_index - vertex_shift;
            return this.click_point_index;
        }

        return -1;
    }

    convert_index_to_zone_index(in_index: number): number {
        let vertex_shift = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            vertex_shift += this.closed_cycles[i].length;
        }
        vertex_shift += this.constructed_cycle.length;
        vertex_shift += this.points.length;

        if (in_index >= vertex_shift && in_index < vertex_shift + this.zones.length) {
            this.click_zone_index = in_index - vertex_shift;
            return this.click_zone_index;
        }

        return -1;
    }

    convert_index_to_connection_index(in_index: number): number {
        let vertex_shift = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            vertex_shift += this.closed_cycles[i].length;
        }
        vertex_shift += this.constructed_cycle.length;
        vertex_shift += this.points.length;
        vertex_shift += this.zones.length;

        if (in_index >= vertex_shift && in_index < vertex_shift + this.connections.length) {
            return in_index - vertex_shift;
        }

        return -1;
    }

    convert_index_to_door_index(in_index: number): number {
        let vertex_shift = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            vertex_shift += this.closed_cycles[i].length;
        }
        vertex_shift += this.constructed_cycle.length;
        vertex_shift += this.points.length;
        vertex_shift += this.zones.length;
        vertex_shift += this.connections.length;

        if (in_index >= vertex_shift && in_index < vertex_shift + this.doors.length) {
            this.click_door_index = in_index - vertex_shift;
            return this.click_door_index;
        }

        return -1;
    }

    add_connection_point(in_point: Vector2D) {
        if (this.constructed_connection.length == 0) {
            // we should add the first point of the connection pair
            // simply add it
            this.constructed_connection.push(in_point.clone());
        } else {
            // we add the second point of the connection pair
            // for this we should get the edge of the outer cycle
            // and reorder points such that the first one will be before the second one
            if (this.closed_cycles.length > 0) {
                const cycle = this.closed_cycles[0];
                const edge_index = get_edge_with_point(cycle, in_point);
                // we assume that all points correct, so in_point and last connection point lies on the same edge
                if (edge_index >= 0) {
                    const start = cycle[edge_index];
                    const end = cycle[(edge_index + 1) % cycle.length];
                    const edge_length = vector2_distance(start, end);
                    // calculate proportion for last connection point
                    const prev_point = this.constructed_connection[this.constructed_connection.length - 1];
                    const prev_t = vector2_distance(prev_point, start) / edge_length;
                    const next_t = vector2_distance(in_point, start) / edge_length;

                    if (prev_t < next_t) {
                        // new point after previous one - simply add to the array
                        this.connections.push(new Connection(prev_point, in_point));
                    } else {
                        this.connections.push(new Connection(in_point, prev_point));
                    }
                    this.constructed_connection.length = 0;
                }
            }
        }
    }

    add_wall_point(in_point: Vector2D) {
        // in_point in world space, it should be the integer point
        // we call the add point
        // it should be potentially valid point
        // so, no additional check

        // at first try to split any path
        // it's possible only at non-mode
        const is_split = this.draw_mode == RoomConstructMode.None ? this._split_edge(in_point) : false;
        if (!is_split) {
            // no split
            // we click not on the edge, but on vertex or space
            if (this.draw_mode == RoomConstructMode.DrawWalls) {
                // in draw mode, if we click at last vertex, then close the current cycle
                // or if we click on space, simply add the point
                if (this.direction_mode == RoomConstructDirection.Head) {
                    // check with the end
                    if (this.constructed_cycle[this.constructed_cycle.length - 1].is_coincide(in_point)) {
                        // point coincide with the end
                        // close the cycle
                        this._close_current();
                    } else {
                        // this is a new point
                        this.constructed_cycle.unshift(in_point);
                    }
                } else {
                    // here we add new points to the end of the array
                    // so, we should check is it coincide with the start
                    if (this.constructed_cycle[0].is_coincide(in_point)) {
                        // close the cycles
                        this._close_current();
                    } else {
                        this.constructed_cycle.push(in_point);
                    }
                }
            } else {
                // in none-mode
                // we can click to start/end of the current cycle
                // or to the empty space to start new cycle
                if (this.constructed_cycle.length == 0) {
                    // empty current path, simply start it
                    this.constructed_cycle.push(in_point);
                    this.draw_mode = RoomConstructMode.DrawWalls;
                    this.direction_mode = RoomConstructDirection.Tail;
                } else {
                    if (this.constructed_cycle[0].is_coincide(in_point)) {
                        this.direction_mode = RoomConstructDirection.Head;
                        this.draw_mode = RoomConstructMode.DrawWalls;
                    } else if (this.constructed_cycle[this.constructed_cycle.length - 1].is_coincide(in_point)) {
                        this.direction_mode = RoomConstructDirection.Tail;
                        this.draw_mode = RoomConstructMode.DrawWalls;
                    }
                }
            }
        }

        this.last_check_point = null;
        this.last_check_tool = null;
    }

    delete_indices(indices: Array<number>): boolean {
        // we should fully rebuild all paths, because after deletion it can change orientation or even degrade
        const new_closed_cycles = new Array<Array<Vector2D>>();
        let vertex_index = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            const cycle = this.closed_cycles[i];
            const new_cycle = new Array<Vector2D>();
            for (let j = 0; j < cycle.length; j++) {
                if (!indices.includes(vertex_index)) {
                    new_cycle.push(cycle[j].clone());
                }
                vertex_index += 1;
            }

            if (new_cycle.length >= 3) {
                // check orientation
                const winding_angle = path_orientation(new_cycle);
                // for first closed cycle it should be positive, for other - negative
                const should_revert = i == 0 ? (winding_angle < 0.0) : (winding_angle > 0.0);
                const final_new_cycle = new Array<Vector2D>();
                for (let j = 0; j < new_cycle.length; j++) {
                    final_new_cycle.push(should_revert ? new_cycle[new_cycle.length - 1 - j] : new_cycle[j]);
                }

                new_closed_cycles.push(final_new_cycle);
            }
        }

        // simillary for constructed path
        const new_constructed_path = new Array<Vector2D>();
        for (let i = 0; i < this.constructed_cycle.length; i++) {
            if (!indices.includes(vertex_index)) {
                new_constructed_path.push(this.constructed_cycle[i].clone());
            }
            vertex_index += 1;
        }
        if (new_constructed_path.length <= 1) {
            new_constructed_path.length = 0;
        }

        // next we should check that combination of paths are valid
        // here we does not need check points, zones and connections correctness
        // if no - simply delete it
        if (is_path_combination_valid(new_closed_cycles, new_constructed_path, new Array<Point>(), new Array<Zone>(), new Array<Connection>(), new Array<Door>())) {
            let points_vertex_shift = 0;
            for (let i = 0; i < this.closed_cycles.length; i++) {
                points_vertex_shift += this.closed_cycles[i].length;
            }
            points_vertex_shift += this.constructed_cycle.length;
            const zones_vertex_shift = points_vertex_shift + this.points.length;
            const connections_vertex_shift = zones_vertex_shift + this.zones.length;
            const doors_vertex_shift = connections_vertex_shift + this.connections.length;
            // next start delete points
            // from last to first
            const points_count = this.points.length;
            for (let i = points_count - 1; i >= 0; i--) {
                if (indices.includes(points_vertex_shift + i)) {
                    // this point in the indices, delete it
                    this.points.splice(i, 1);
                } else {
                    // check, may be this point outside of the outer cycle
                    if (new_closed_cycles.length > 0 && !is_point_inside(new_closed_cycles[0], this.points[i].get_position())) {
                        this.points.splice(i, 1);
                    } else {
                        // also all other cycles
                        for (let j = 1; j < new_closed_cycles.length; j++) {
                            if (is_point_inside(new_closed_cycles[j], this.points[i].get_position())) {
                                this.points.splice(i, 1);
                            }
                        }
                    }
                }
            }

            // and then delete zones
            const zones_count = this.zones.length;
            for (let i = zones_count - 1; i >= 0; i--) {
                if (indices.includes(zones_vertex_shift + i)) {
                    this.zones.splice(i, 1);
                } else {
                    if (!is_point_inside(new_closed_cycles[0], this.zones[i].get_position())) {
                        this.zones.splice(i, 1);
                    } else {
                        for (let j = 1; j < new_closed_cycles.length; j++) {
                            if (is_point_inside(new_closed_cycles[j], this.zones[i].get_position())) {
                                this.zones.splice(i, 1);
                            }
                        }
                    }
                }
            }

            // connections
            for (let i = this.connections.length - 1; i >= 0; i--) {
                if (new_closed_cycles.length == 0 || indices.includes(connections_vertex_shift + i)) {
                    this.connections.splice(i, 1);
                } else {
                    // we should check that all point of the connection lies on the same edge of the outer cycle
                    const c = this.connections[i];
                    if (!are_points_on_the_same_edge(new_closed_cycles[0], c.get_start(), c.get_end())) {
                        this.connections.splice(i, 1);
                    }
                }
            }

            // doors
            const doors_count = this.doors.length;
            for (let i = doors_count - 1; i >= 0; i--) {
                if (indices.includes(doors_vertex_shift + i)) {
                    this.doors.splice(i, 1);
                } else {
                    if (!is_point_inside(new_closed_cycles[0], this.doors[i].get_center())) {
                        this.doors.splice(i, 1);
                    } else {
                        for (let j = 1; j < new_closed_cycles.length; j++) {
                            if (is_point_inside(new_closed_cycles[j], this.doors[i].get_center())) {
                                this.doors.splice(i, 1);
                            }
                        }
                    }
                }
            }

            this.constructed_cycle = new_constructed_path;
            this.closed_cycles = new_closed_cycles;
            this.last_check_point = null;
            return true;
        }

        return false;
    }

    reset_draw_mode() {
        this.draw_mode = RoomConstructMode.None;

        if (this.constructed_cycle.length == 1) {
            this.constructed_cycle.length = 0;
        }
    }

    get_draw_mode(): RoomConstructMode {
        return this.draw_mode;
    }

    get_direction_mode(): RoomConstructDirection {
        return this.direction_mode;
    }

    get_vertex_position(index: number): Vector2D | null {
        // index is the global index of vertices across all paths
        let counter = index;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            const cycle = this.closed_cycles[i];
            if (counter >= cycle.length) {
                counter -= cycle.length;
            } else {
                return cycle[counter];
            }
        }
        if (counter >= 0 && counter < this.constructed_cycle.length) {
            return this.constructed_cycle[counter];
        }

        counter -= this.constructed_cycle.length;
        if (counter >= 0 && counter < this.points.length) {
            return this.points[counter].get_position();
        }

        counter -= this.points.length;
        if (counter >= 0 && counter < this.zones.length) {
            return this.zones[counter].get_position();
        }

        counter -= this.zones.length;
        if (counter >= 0 && counter < this.connections.length) {
            // for connections always return coordinates of the start point
            return this.connections[counter].get_start();
        }

        counter -= this.connections.length;
        if (counter >= 0 && counter < this.doors.length) {
            return this.doors[counter].get_center();
        }

        // if we return null, then it means that vertex with target index is deleted
        // for example, when we move item and it disappear after filtering
        return null;
    }

    get_aabb(padding: number = 0.0, specific_indices: Array<number> | null = null): AABB {
        // return bounding box for all vertices
        // add padding to make aabb non-trivial
        // if specific_indices array is not null, then consider vertices only with that indices

        const required_positions = new Array<Vector2D>();
        let vertex_index = 0;
        for (let i = 0; i < this.closed_cycles.length; i++) {
            const cycle = this.closed_cycles[i];
            for (let j = 0; j < cycle.length; j++) {
                if (specific_indices == null || (specific_indices != null && specific_indices.includes(vertex_index))) {
                    required_positions.push(cycle[j]);
                }
                vertex_index += 1;
            }
        }

        for (let i = 0; i < this.constructed_cycle.length; i++) {
            if (specific_indices == null || (specific_indices != null && specific_indices.includes(vertex_index))) {
                required_positions.push(this.constructed_cycle[i]);
            }
            vertex_index += 1;
        }

        if (required_positions.length == 0) {
            // empty room, nothing to return
            const to_return = new AABB();
            to_return.extend_by_padding(padding);
            return to_return;
        }

        const to_return = new AABB(required_positions[0], required_positions[0]);
        for (let i = 1; i < required_positions.length; i++) {
            to_return.extend_by_position(required_positions[i]);
        }

        to_return.extend_by_padding(padding);

        return to_return;
    }

    move_vertices(controller_index: number, controller_position: Vector2D, other_vectors: Map<number, Vector2D>, step_type: ItemStepType) {
        // for the move, we should construct new paths collections and check is it valid
        // if yes, reassign it to the cycles and path
        // if no - no reassign

        // controller_index - index of the item in the global order which is clicked and moved
        // controller_position - current cursor position
        // other_vectors - map from selected index to shift with respect to position of controller index

        // WARNING: when introduce new item - implement proper get_vertex_position function
        const controller_source = this.get_vertex_position(controller_index);
        if (controller_source && !controller_source.is_coincide(controller_position)) {
            if (step_type == ItemStepType.Integer) {
                const new_closed_cycles = new Array<Array<Vector2D>>();
                const new_constructed_path = new Array<Vector2D>();
                const new_connections = new Array<Connection>();

                let vertex_index = 0;
                for (let i = 0; i < this.closed_cycles.length; i++) {
                    const cycle = this.closed_cycles[i];
                    const new_cycle = new Array<Vector2D>();
                    for (let j = 0; j < cycle.length; j++) {
                        if (vertex_index == controller_index) {
                            new_cycle.push(controller_position);
                        } else {
                            if (other_vectors.has(vertex_index)) {
                                // shift position from controller one
                                const shift = other_vectors.get(vertex_index);
                                if (shift) {
                                    new_cycle.push(new Vector2D(controller_position.get_x() + shift.get_x(), controller_position.get_y() + shift.get_y()));
                                }
                            } else {
                                new_cycle.push(cycle[j]);
                            }
                        }

                        vertex_index += 1;
                    }
                    new_closed_cycles.push(new_cycle);
                }
                // next transfer last path
                for (let i = 0; i < this.constructed_cycle.length; i++) {
                    if (vertex_index == controller_index) {
                        new_constructed_path.push(controller_position);
                    } else {
                        if (other_vectors.has(vertex_index)) {
                            const shift = other_vectors.get(vertex_index);
                            if (shift) {
                                new_constructed_path.push(new Vector2D(controller_position.get_x() + shift.get_x(), controller_position.get_y() + shift.get_y()));
                            }
                        } else {
                            new_constructed_path.push(this.constructed_cycle[i]);
                        }
                    }
                    vertex_index += 1;
                }

                // increase index by adding shift for points and zones
                // we does not move it here
                vertex_index += this.points.length;
                vertex_index += this.zones.length;

                // connections
                for (let i = 0; i < this.connections.length; i++) {
                    const old_connection = this.connections[i];
                    if (vertex_index == controller_index) {
                        // for connection when we click on controlled connection - we define the pivot
                        // so, cursor position - is the pivot position
                        // we should recalculate start and end position from it
                        const new_start = controller_position.clone();
                        const new_end = vector2_add(new_start, vector2_subtract(old_connection.get_end(), old_connection.get_start()));
                        const new_connection = new Connection(new_start, new_end);
                        new_connections.push(new_connection);
                    } else {
                        if (other_vectors.has(vertex_index)) {
                            const shift = other_vectors.get(vertex_index);
                            // shift contains the vector from original item position to original controller position
                            if (shift) {
                                const new_connection = new Connection(
                                    vector2_add(controller_position, shift),
                                    vector2_add(controller_position, vector2_add(shift, vector2_subtract(old_connection.get_end(), old_connection.get_start())))
                                );
                                new_connections.push(new_connection);
                            }
                        } else {
                            new_connections.push(new Connection(old_connection.get_start(), old_connection.get_end()));
                        }
                    }
                    vertex_index += 1;
                }

                // check is combination of paths are valid
                if (is_path_combination_valid(new_closed_cycles, new_constructed_path, this.points, this.zones, new_connections, this.doors, true)) {
                    // update positions
                    this.closed_cycles = new_closed_cycles;
                    this.constructed_cycle = new_constructed_path;
                    this.connections = new_connections;

                    this._filter_points();
                    this._filter_zones();
                    this._filter_connections();
                    this._filter_doors();
                }
            } else if (step_type == ItemStepType.Half) {
                // as previously, create temp arrays, update positions and then check correctness
                // if all ok, reassign, if no - nothing to do
                // no filters here
                let vertex_index = 0;
                for (let i = 0; i < this.closed_cycles.length; i++) {
                    vertex_index += this.closed_cycles[i].length;
                }
                vertex_index += this.constructed_cycle.length;

                const new_points = new Array<Point>();
                const new_zones = new Array<Zone>();
                const new_doors = new Array<Door>();

                for (let i = 0; i < this.points.length; i++) {
                    const old_point = this.points[i];
                    if (vertex_index == controller_index) {
                        new_points.push(new Point(controller_position, old_point.get_angle()));
                    } else {
                        const shift = other_vectors.get(vertex_index);
                        // if there is a shift, then this point selected and should move
                        if (shift) {
                            new_points.push(new Point(vector2_add(controller_position, shift), old_point.get_angle()));
                        } else {
                            // if shift is null - simple recreate the point
                            new_points.push(new Point(old_point.get_position(), old_point.get_angle()));
                        }
                    }
                    vertex_index += 1;
                }

                for (let i = 0; i < this.zones.length; i++) {
                    const old_zone = this.zones[i];
                    if (vertex_index == controller_index) {
                        new_zones.push(new Zone(controller_position, old_zone.get_radius()));
                    } else {
                        const shift = other_vectors.get(vertex_index);
                        if (shift) {
                            new_zones.push(new Zone(vector2_add(controller_position, shift), old_zone.get_radius()));
                        } else {
                            new_zones.push(new Zone(old_zone.get_position(), old_zone.get_radius()));
                        }
                    }
                    vertex_index += 1;
                }

                // we should shift the vertex index, because connections considered in other case (snap-1)
                // WARNING: does not forget to add these shifts when required
                vertex_index += this.connections.length;

                for (let i = 0; i < this.doors.length; i++) {
                    const old_door = this.doors[i];
                    if (vertex_index == controller_index) {
                        new_doors.push(new Door(controller_position, old_door.get_angle()));
                    } else {
                        const shift = other_vectors.get(vertex_index);
                        if (shift) {
                            new_doors.push(new Door(vector2_add(controller_position, shift), old_door.get_angle()));
                        } else {
                            new_doors.push(new Door(old_door.get_center(), old_door.get_angle()));
                        }
                    }
                    vertex_index += 1;
                }

                if (is_path_combination_valid(this.closed_cycles, this.constructed_cycle, new_points, new_zones, this.connections, new_doors, true)) {
                    this.points = new_points;
                    this.zones = new_zones;
                    this.doors = new_doors;
                }
            }
        }

        // in any case, reset check cache
        this.last_check_point = null;
        this.last_check_tool = null;
    }

    is_empty(): boolean {
        // return true if there are no points in cycles and paths
        return this.closed_cycles.length == 0 && this.constructed_cycle.length <= 1;
    }
}

export class RoomStore {
    private closed_cycles: Array<Array<Vector2D>> = new Array<Array<Vector2D>>();
    private constructed_cycle: Array<Vector2D> = new Array<Vector2D>();

    private id: number = 0;
    private preview_img: string;
    private name: string;
    private collections: Array<string>;
    private points: Array<Point>;
    private zones: Array<Zone>;
    private connections: Array<Connection>;
    private doors: Array<Door>;

    constructor(in_closed_cycles: Array<Array<Vector2D>>,
                in_constructed_cycle: Array<Vector2D>,
                in_id: number,
                in_preview_img: string,
                in_name: string,
                in_collection: string,
                in_points: Array<Point>,
                in_zones: Array<Zone>,
                in_connections: Array<Connection>,
                in_doors: Array<Door>) {
        this.closed_cycles = in_closed_cycles.map(array =>
            array.map(vec => vec.clone()));
        this.constructed_cycle = in_constructed_cycle.map(vec => vec.clone());
        this.id = in_id;
        this.preview_img = in_preview_img;

        this.name = in_name;
        this.collections = this._collection_to_array(in_collection);

        this.points = in_points.map(p => p.clone());
        this.zones = in_zones.map(z => z.clone());
        this.connections = in_connections.map(c => c.clone());
        this.doors = in_doors.map(d => d.clone());
    }

    private _collection_to_array(in_string: string): Array<string> {
        return in_string.trim().split(/\s+/);
    }

    update_content(in_closed_cycles: Array<Array<Vector2D>>,
                   in_constructed_cycle: Array<Vector2D>,
                   in_preview_img: string,
                   in_points: Array<Point>,
                   in_zones: Array<Zone>,
                   in_connections: Array<Connection>,
                   in_doors: Array<Door>) {
        this.closed_cycles = in_closed_cycles.map(array =>
            array.map(vec => vec.clone()));
        this.constructed_cycle = in_constructed_cycle.map(vec => vec.clone());
        this.preview_img = in_preview_img;

        this.points = in_points.map(p => p.clone());
        this.zones = in_zones.map(z => z.clone());
        this.connections = in_connections.map(c => c.clone());
        this.doors = in_doors.map(d => d.clone());
    }

    update_name(in_name: string) {
        this.name = in_name;
    }

    update_collections(in_collection: string) {
        this.collections = this._collection_to_array(in_collection);
    }

    get_id(): number {
        return this.id;
    }

    get_closed_count(): number {
        return this.closed_cycles.length;
    }

    get_closed(index: number): Array<Vector2D> {
        return this.closed_cycles[index];
    }

    get_all_closed(): Array<Array<Vector2D>> {
        return this.closed_cycles;
    }

    get_constructed(): Array<Vector2D> {
        return this.constructed_cycle;
    }

    get_preview(): string {
        return this.preview_img;
    }

    get_name(): string {
        return this.name;
    }

    get_collections(): Array<string> {
        return this.collections;
    }

    get_points(): Array<Point> {
        return this.points;
    }

    get_zones(): Array<Zone> {
        return this.zones;
    }

    get_connections(): Array<Connection> {
        return this.connections;
    }

    get_doors(): Array<Door> {
        return this.doors;
    }

    is_empty(): boolean {
        // the same as in constructor class
        return this.closed_cycles.length == 0 && this.constructed_cycle.length <= 1;
    }
}