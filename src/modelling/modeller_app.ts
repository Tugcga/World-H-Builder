import { AABB } from "../math/aabb";
import { Transform } from "../math/transform";
import { Vector2D } from "../math/vector";
import { BackgroundCanvas } from "./canvas/canvas_background";
import { BlueprintCanvas } from "./canvas/canvas_blueprint";
import { SelectCanvas } from "./canvas/canvas_select";
import { RoomConstructor, RoomStore } from "./room";
import { delete_room, load_rooms, save_room } from "./store";
import { ControlState, ItemStepType, KeyboardModification, MouseButton, RoomConstructDirection, RoomConstructMode, Tool, UpdateCanvasMode } from "./types";

const LEFT_PANNEL_ID = "pannel_left";
const RIGHT_PANNEL_ID = "pannel_right";
const BACKGROUND_CANVAS_ID = "background_canvas";
const FRONT_CANVAS_ID = "front_canvas";
const SELECT_CANVAS_ID = "picks_canvas";
const CANVAS_ZONE_ID = "canvas_zone";
const TOOL_BUTTON_SELECT_ID = "select_tool";
const TOOL_BUTTON_DRAW_ID = "draw_tool";
const TOOL_BUTTON_CAMERA_ID = "camera_tool";
const TOOL_BUTTON_POINT_ID = "point_tool";
const TOOL_BUTTON_ZONE_ID = "zone_tool";
const TOOL_BUTTON_CONNECTION_ID = "connection_tool";
const TOOL_BUTTON_DOOR_ID = "door_tool";

/* To introduce new tool:
1. Add button to the html with specific id TOOL_BUTTON_*_ID
2. Store this id in global constant
3. Create class member for button
4. Define button callbacks
5. In update_tools method define non-active style and activate it with respect to active tool
6. In on_keypress method activate the tool by hot-key. Define this hotkey as constant ACTIVATE_*_TOOL_KEY
7. In method on_mouse_press define logic when click canvas with active tool. In general case it required describe what should happens when click left MB, and if click right MB. Also here describe click with modifications
Common pattern: when right-click in draw mode - then delete subject. For this purpose get from the room the index of the item
and check that this index point to the proper item type (by converting general index to local items index)
When left-click - create the item and switch to other control state

The variable potential_point_to_add contains valid coordinates for the next mouse click
It defined in on_mouse_move_draw method if no special state is selected

8. To define is the current point is potential to add, use this.room.is_valid_point(int_world_position, this.active_tool)
It accept the current tool and should return is world position is valid or not
This method is called in draw callback for mouse drag

9. To draw tool effect - use blueprint canvas
It already contains required data

10. on_tool_change called when the active tool is changed. In this method it's possible to reset modes of the draw tool
11. this.room.get_index_at_point should consider to return an index of a new created objects by the tool
12. Also in the room it should be filtered object when move room cycles
13. this.room.get_vertex_position should return position of the item with given index
indexes are in one global order: cycles, points, zones, connections and so on
14. this.room.move_vertices manage position of room items when we click and move something
15. When we add items to selection, we should check are they have the same step-type
for example: connections and wall points snaps to grid with step = 1.0
but points and zones - 0.5
So, we can not select different types, because when we move, we should use one of fixed grid: either 0.5, or 1.0
This filtered in this._is_index_agreed_step_size
So, room.move_vertex should implement different behaviour for different items with the similar step size
for now we have two types: 1.0 for walls and connections, 0.5 for points and zones

16. When add new item, add it to the correctness check inside room.move_vertices() 

 */

const LOAD_LEVEL_BUTTON_PLATE_CLASS = "level_button_wrapper"
const LOAD_LEVEL_BUTTON_BUTTON_CLASS = "level_button"
const LOAD_LEVEL_BUTTON_CAPTION_CLASS = "level_button_caption"
const LOAD_LEVEL_BUTTON_NAME_CLASS = "level_button_name"
const LOAD_LEVEL_BUTTON_ID_CLASS = "level_button_id"
const SETTINGS_CLASS = "settings_set";
const SETTINGS_LEGEND_CLASS = "settings_legend";

const TOOL_ACTIVE_CLASS = "tool_active";
const TOOL_NONACTIVE_CLASS = "tool_nonactive";
const TOOL_CLASS = "tool_button";

const ACTIVATE_CAMERA_TOOL_KEY = "s";
const ACTIVATE_SELECT_TOOL_KEY = " ";
const ACTIVATE_DRAW_WALL_TOOL_KEY = "d";
const ACTIVATE_DRAW_POINT_TOOL_KEY = "p";
const ACTIVATE_DRAW_ZONE_TOOL_KEY = "z";
const ACTIVATE_DRAW_CONNECTION_TOOL_KEY = "c";
const ACTIVATE_DRAW_DOOR_TOOL_KEY = "v";
const DELETE_COMMAND = "Delete";
const FRAME_COMMAND = "f";
const FRAME_ALL_COMMAND = "a";

const SETTINGS_LABEL_STR = "Room Settings";
const SETTINGS_ROOM_LABEL_STR = "Name";
const SETTINGS_ROOM_CATEGORY_STR = "Category";

const SETTINGS_ROOM_NAME_ID = "room_name";
const SETTINGS_ROOM_COLLECTION_ID = "collection";

const START_CAMERA_SCALE = 24;  // the number of pixels for one unit
const MOVE_CAMERA_SPEED = 1.0;
const SCALE_CAMERA_SPEED = 0.005;
const SCALE_CAMERA_MINIMUM = 1.0;
const SWITCH_CAMERA_TOOL_TIME = 200;  // in milliseconds
const SELECT_VERTEX_DELTA = 10;
const FRAME_WORLD_PADDING = 1.0;  // in world units
const FRAME_CANVAS_PADDING = 45;  // in pixels

// sync with .level_button style
const PREVIEW_LEVEL_WIDTH = 188;
const PREVIEW_LEVEL_HEIGHT = 96;

function event_mouse_button(event: MouseEvent): MouseButton {
    return event.button == 0 ? MouseButton.Left : (event.button == 1 ? MouseButton.Middle : (event.button == 2 ? MouseButton.Right : MouseButton.Unknown));
}

function event_mouse_modification(event: MouseEvent): KeyboardModification {
    if (event.shiftKey) {
        return KeyboardModification.Shift;
    } else if (event.altKey) {
        return KeyboardModification.Alt;
    }

    return KeyboardModification.Unknown;
}

function round_position_to_grid(x: number, y: number, cell_size: number): Vector2D {
    return new Vector2D(Math.round(x / cell_size) * cell_size, Math.round(y / cell_size) * cell_size)
}

export class ModellerApp {
    private left_pannel: HTMLDivElement;
    private new_level_button: HTMLDivElement | null = null;
    private load_buttons: Map<number, HTMLButtonElement> = new Map<number, HTMLButtonElement>();
    private load_plates: Map<number, HTMLDivElement> = new Map<number, HTMLDivElement>();
    private load_names: Map<number, HTMLSpanElement> = new Map<number, HTMLSpanElement>();
    private render_canvas: HTMLCanvasElement | null = null;
    private render_ctx: CanvasRenderingContext2D | null = null;
    private rooms_store_list: Map<number, RoomStore> = new Map<number, RoomStore>();

    private right_pannel: HTMLDivElement;

    private world_to_canvas_tfm: Transform = new Transform();
    private control_state: ControlState = ControlState.Idle;
    private background_canvas: BackgroundCanvas;
    private blueprint_canvas: BlueprintCanvas;
    private select_canvas: SelectCanvas;

    private canvas_rect: DOMRect;

    private start_move_canvas: Vector2D = new Vector2D();  // store here click position when we start move canvas
    private start_move_camera: Vector2D = new Vector2D();  // here store position of the camera at the move start
    private start_select_canvas: Vector2D = new Vector2D();
    private selected_indices: Array<number> = new Array<number>();

    private tool_button_select: HTMLButtonElement;
    private tool_button_draw: HTMLButtonElement;
    private tool_button_camera: HTMLButtonElement;
    private tool_button_point: HTMLButtonElement;
    private tool_button_zone: HTMLButtonElement;
    private tool_button_connection: HTMLButtonElement;
    private tool_button_door: HTMLButtonElement;

    private start_scale_canvas: Vector2D = new Vector2D();
    private start_scale_world: Vector2D = new Vector2D();
    private start_scale_camera: number = 1.0;

    private current_mouse_position: Vector2D = new Vector2D();  // track here current mouse position
    // in canvas space, to use when required

    private canvas_width: number = 0;
    private canvas_height: number = 0;

    private active_tool: Tool = Tool.Select;
    private previous_tool: Tool = Tool.Select;  // remember tool before activate camera by the keyboard

    private press_camera_tool_time: number = 0.0;  // store here the time when we press the camera tool button
    // used for switch the mode

    private click_move_vertex_index: number = 0;  // what vertex was clicked to move
    private click_move_selected_vectors: Map<number, Vector2D> = new Map<number, Vector2D>();  // vectors to other selected vertices
    // key - other vertex index, value - vector from click vertex to this vertex in world space

    private room: RoomConstructor = new RoomConstructor(0);
    private potential_point_do_add: Vector2D | null = null;  // in world space

    // pass input the root div for the application
    constructor(root_div: HTMLDivElement) {
        this.background_canvas = new BackgroundCanvas(root_div, BACKGROUND_CANVAS_ID, CANVAS_ZONE_ID);
        this.blueprint_canvas = new BlueprintCanvas(root_div, FRONT_CANVAS_ID, CANVAS_ZONE_ID);
        this.select_canvas = new SelectCanvas(root_div, SELECT_CANVAS_ID, CANVAS_ZONE_ID);

        this.tool_button_select = root_div.querySelector("#" + TOOL_BUTTON_SELECT_ID) as HTMLButtonElement;
        this.tool_button_draw = root_div.querySelector("#" + TOOL_BUTTON_DRAW_ID) as HTMLButtonElement;
        this.tool_button_camera = root_div.querySelector("#" + TOOL_BUTTON_CAMERA_ID) as HTMLButtonElement;
        this.tool_button_point = root_div.querySelector("#" + TOOL_BUTTON_POINT_ID) as HTMLButtonElement;
        this.tool_button_zone = root_div.querySelector("#" + TOOL_BUTTON_ZONE_ID) as HTMLButtonElement;
        this.tool_button_connection = root_div.querySelector("#" + TOOL_BUTTON_CONNECTION_ID) as HTMLButtonElement;
        this.tool_button_door = root_div.querySelector("#" + TOOL_BUTTON_DOOR_ID) as HTMLButtonElement;

        this.right_pannel = root_div.querySelector("#" + RIGHT_PANNEL_ID) as HTMLDivElement;
        this._add_room_settings_to_right_pannel();

        this.left_pannel = root_div.querySelector("#" + LEFT_PANNEL_ID) as HTMLDivElement;
        // add to the left pannel button for the new level
        this._add_level_button_to_left_pannel(true);

        // init world to canvas transform
        // we assume that all canvases have the same size
        const canvas = root_div.querySelector("#" + BACKGROUND_CANVAS_ID) as HTMLCanvasElement
        this.canvas_width = canvas.width;
        this.canvas_height = canvas.height;
        this.world_to_canvas_tfm.set_position_coords(this.canvas_width / 2, this.canvas_height / 2);
        this.world_to_canvas_tfm.set_scale_values(START_CAMERA_SCALE, -START_CAMERA_SCALE);

        this.tool_button_select.addEventListener("click", (event) => this.on_tool(event, Tool.Select)); 
        this.tool_button_select.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });
        this.tool_button_draw.addEventListener("click", (event) => this.on_tool(event, Tool.WallDraw)); 
        this.tool_button_draw.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });
        this.tool_button_camera.addEventListener("click", (event) => this.on_tool(event, Tool.Camera)); 
        this.tool_button_camera.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });
        this.tool_button_point.addEventListener("click", (event) => this.on_tool(event, Tool.PointDraw)); 
        this.tool_button_point.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });
        this.tool_button_zone.addEventListener("click", (event) => this.on_tool(event, Tool.ZoneDraw)); 
        this.tool_button_zone.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });
        this.tool_button_connection.addEventListener("click", (event) => this.on_tool(event, Tool.ConnectionDraw)); 
        this.tool_button_connection.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });
        this.tool_button_door.addEventListener("click", (event) => this.on_tool(event, Tool.DoorDraw)); 
        this.tool_button_door.addEventListener("mousedown", (event: MouseEvent) => { event.stopPropagation(); });

        load_rooms().then(rooms_map => {
            this.rooms_store_list = rooms_map;
            for (const [id, room] of this.rooms_store_list) {
                this._add_level_button_to_left_pannel(false, room.get_name(), room.get_id(), room.get_preview());
            }

            this.on_new_level();

            // here we define styles for button on tool panel
            this.update_tools();
        });

        const self = this;
        this.canvas_rect = canvas.getBoundingClientRect();
        document.addEventListener("mousedown", function(event) {
            if (event.buttons == 1) {
                self.on_mouse_press(event.clientX - self.canvas_rect.left, event.clientY - self.canvas_rect.top, event_mouse_button(event), event_mouse_modification(event));
            } else if (event.buttons == 4) {
                self.on_mouse_press(event.clientX - self.canvas_rect.left, event.clientY - self.canvas_rect.top, event_mouse_button(event), event_mouse_modification(event));
                event.preventDefault();
            }
        });

        document.addEventListener("mouseup", function(event) {
            self.on_mouse_release(event_mouse_button(event), event_mouse_modification(event));
        });

        document.addEventListener("mousemove", function(event) {
            self.on_mouse_move(event.clientX - self.canvas_rect.left, event.clientY - self.canvas_rect.top);
        });

        document.addEventListener('contextmenu', function(event) {
            event.preventDefault();
            self.on_mouse_press(event.clientX - self.canvas_rect.left, event.clientY - self.canvas_rect.top, MouseButton.Right, event_mouse_modification(event));
        });

        // keyboard events
        document.addEventListener("keydown", function(event) {
            if (event.repeat == false) {
                const tag = document.activeElement?.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA") {
                    return;
                }
                self.on_keypress(event.key);
                event.preventDefault();
            }
        });

        document.addEventListener("keyup", function(event) {
            self.on_keyup(event.key);
        });

        window.addEventListener("resize", function(event) {
            self.background_canvas.on_resize();
            self.blueprint_canvas.on_resize();
            self.select_canvas.on_resize();

            self.canvas_width = canvas.width;
            self.canvas_height = canvas.height;

            self.update_canvas();
        });

        this.update_canvas();
    }

    private _add_param_to_settings(settings: HTMLFieldSetElement,
                                   label_string: string,
                                   id_string: string,
                                   value: string | number) {
        const row = document.createElement("div");
        row.className = "settings_row";

        const label_element = document.createElement("label");
        label_element.setAttribute("for", id_string);
        label_element.textContent = label_string;

        const input = document.createElement("input");
        input.type = 'text';
        input.id = id_string;
        input.value = value.toString();

        row.appendChild(label_element);
        row.appendChild(input);
        settings.appendChild(row);
    }

    private _add_room_settings_to_right_pannel() {
        const room_set = document.createElement("fieldset");
        room_set.className = SETTINGS_CLASS;

        const legend = document.createElement("legend");
        legend.className = SETTINGS_LEGEND_CLASS;
        legend.textContent = SETTINGS_LABEL_STR;
        room_set.appendChild(legend);

        this.right_pannel.appendChild(room_set);

        this._add_param_to_settings(room_set, SETTINGS_ROOM_LABEL_STR, SETTINGS_ROOM_NAME_ID, "The Room");
        this._add_param_to_settings(room_set, SETTINGS_ROOM_CATEGORY_STR, SETTINGS_ROOM_COLLECTION_ID, "room");

        // add callback to change room name input
        this._define_right_pannel_events();
    }

    private _define_right_pannel_events() {
        this.right_pannel.addEventListener("input", (event) => {
            const target = event.target as HTMLInputElement;
            if (target.tagName !== "INPUT") return;

            const field_id = target.id;
            const field_value = target.value;

            const room_id = this.room.get_id();
            const room_storage = this.rooms_store_list.get(room_id);
            const button_label = this.load_names.get(room_id);
            if (room_storage && button_label) {
                if (field_id == SETTINGS_ROOM_NAME_ID) {
                    room_storage.update_name(field_value);
                    button_label.textContent = field_value;
                } else if (field_id == SETTINGS_ROOM_COLLECTION_ID) {
                    room_storage.update_collections(field_value);
                }

                save_room(room_storage);
            }
        });

        this.right_pannel.addEventListener("keydown", (event) => {
            const target = event.target as HTMLElement;
            if (target.tagName !== "INPUT") return;

            if (event.code === 'Enter' || event.key === 'Enter') {
                event.preventDefault();
                target.blur();
            }
        });
    }

    private _add_level_button_to_left_pannel(is_new_level: boolean, name: string | null = null, id: number | null = null, preview_img: string | null = null) {
        const plate = document.createElement("div");
        plate.className = LOAD_LEVEL_BUTTON_PLATE_CLASS;

        const button = document.createElement("button");
        button.className = LOAD_LEVEL_BUTTON_BUTTON_CLASS;

        const caption = document.createElement("div");
        caption.className = LOAD_LEVEL_BUTTON_CAPTION_CLASS;

        const name_span = document.createElement("span");
        name_span.className = LOAD_LEVEL_BUTTON_NAME_CLASS;

        const id_span = document.createElement("span");
        id_span.className = LOAD_LEVEL_BUTTON_ID_CLASS;

        caption.appendChild(name_span);
        caption.appendChild(id_span);

        plate.appendChild(button);
        plate.appendChild(caption);

        if (!is_new_level && id != null) {
            const close_button = document.createElement("button");
            close_button.className = "level_button_close";
            close_button.textContent = "✕";
            close_button.addEventListener("click", (e) => {
                e.stopPropagation();
                this.on_delete_level_button(id);
            });
            plate.appendChild(close_button);
        }

        if (is_new_level) {
            this.new_level_button = plate;
            button.innerText = "+";

            button.onclick = () => { this.on_new_level(); }
            this.left_pannel.appendChild(plate);
        } else if (name && id != null && preview_img) {
            name_span.textContent = name;
            id_span.textContent = id.toString();

            button.style.backgroundImage = `url(${preview_img})`;
            button.onclick = () => { this.on_load_level(id); }
            this.load_buttons.set(id, button);
            this.load_plates.set(id, plate);
            this.load_names.set(id, name_span);

            // add to the pannel
            this.left_pannel.insertBefore(plate, this.new_level_button);
        }
    }

    private on_tool(event: PointerEvent, tool: Tool) {
        event.stopPropagation();
        if (event.target) {
            (event.target as HTMLElement).blur();
        }

        this.on_change_tool(this.active_tool, tool);
        this.active_tool = tool;
        this.update_tools();
        this.update_canvas();
    }

    private _get_room_point_index(x: number, y: number) {
        /* all vertices in the room has one set of indices:
        - closed cycles
        - constructed polyline
        - point
        - zones
        - connections
        - doors */
        const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
        const world_point = canvas_to_world_tfm.apply_coordinates(x, y);
        const world_scale = canvas_to_world_tfm.get_scale();
        const index = this.room.get_index_at_point(world_point, world_scale.get_x() * SELECT_VERTEX_DELTA);

        return index;
    }

    private _index_to_step_type(index: number): ItemStepType  {
        const wall_index = this.room.convert_index_to_wall_index(index);
        if (wall_index >= 0) { return ItemStepType.Integer; }

        const point_index = this.room.convert_index_to_point_index(index);
        if (point_index >= 0) { return ItemStepType.Half; }

        const zone_index = this.room.convert_index_to_zone_index(index);
        if (zone_index >= 0) { return ItemStepType.Half; }
        
        const connection_index = this.room.convert_index_to_connection_index(index);
        if (connection_index >= 0) { return ItemStepType.Integer; }

        const door_index = this.room.convert_index_to_door_index(index);
        if (door_index >= 0) { return ItemStepType.Half; }

        return ItemStepType.Integer;
    }

    private _is_index_agreed_step_size(index: number, index_array: Array<number>) {
        if (index_array.length == 0) {
            return true;
        }

        const first_type = this._index_to_step_type(index_array[0]);
        const index_type = this._index_to_step_type(index);
        if (first_type == index_type) {
            return true;
        }

        return false;
    }

    private on_mouse_press(x: number, y: number, button: MouseButton, mod: KeyboardModification) {
        if (x < 0 || x > this.canvas_width || y < 0 || y > this.canvas_height) {
            return;
        }
        if (this.active_tool == Tool.Select && button == MouseButton.Left) {
            // check may be we click over existed room vertex
            // in this case we should simply select this vertex and does not create selector rectangle
            const index = this._get_room_point_index(x, y);
            if (index >= 0) {
                // we click at the vertex of the room path
                if (mod == KeyboardModification.Shift) {
                    // add vertex index to selected
                    if (!this.selected_indices.includes(index) && this._is_index_agreed_step_size(index, this.selected_indices)) {
                        this.selected_indices.push(index);
                    }

                    this.control_state = ControlState.Idle;
                } else if (mod == KeyboardModification.Alt) {
                    // we click something with alt-key
                    // alt-mode supported only by points and zones to change angle and radius
                    // we, we should check that we click actually on point or zone
                    const point_index = this.room.convert_index_to_point_index(index);
                    if (point_index >= 0) {
                        this.control_state = ControlState.RotatePoint;
                    } else {
                        const zone_index = this.room.convert_index_to_zone_index(index);
                        if (zone_index >= 0) {
                            this.control_state = ControlState.ScaleZone;
                        } else {
                            const door_index = this.room.convert_index_to_door_index(index);
                            if (door_index >= 0) {
                                this.control_state = ControlState.DirectDoor;
                            }
                        }
                    }
                    // clear selection
                    this.selected_indices.length = 0;
                } else {
                    // check, may be we click to the already selected vertex
                    // in this case we should turn into move points state
                    // and if we click non-selected vertex, then select and turn to move state
                    if (this.selected_indices.includes(index)) {
                        // yes, click already selected
                        // nothing to do
                        // simply change the control state
                    } else {
                        // click at new vertex
                        this.selected_indices.length = 0;
                        this.selected_indices.push(index);
                    }

                    // we should remember, what vertex is clicked and where it was at click moment
                    // and also vectors to other selected vertices
                    this.click_move_vertex_index = index;
                    this.click_move_selected_vectors.clear();
                    const index_position = this.room.get_vertex_position(index);
                    if (index_position) {
                        for (let i = 0; i < this.selected_indices.length; i++) {
                            const other_index = this.selected_indices[i];
                            if (other_index == index) {
                                continue;
                            }

                            const p = this.room.get_vertex_position(other_index);
                            if (p) {
                                this.click_move_selected_vectors.set(
                                    other_index, 
                                    new Vector2D(p.get_x() - index_position.get_x(), p.get_y() -  index_position.get_y()));
                            }
                        }
                    }

                    this.control_state = ControlState.MovePoints;
                }
                this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            } else {
                // we click at free canvas space
                // remember in select canvas, where we click
                this.start_select_canvas = new Vector2D(x, y);
                this.select_canvas.define_start_select(this.start_select_canvas)
                this.control_state = ControlState.Select;
            }
        } else if (this.active_tool == Tool.Camera) {
            if (button == MouseButton.Left) {
                // activate canvas move state
                this.control_state = ControlState.MoveCanvas;
                this.start_move_canvas = new Vector2D(x, y);  // start point on canvas

                const p = this.world_to_canvas_tfm.get_position();
                this.start_move_camera = new Vector2D(p.get_x(), p.get_y());
            } else if (button == MouseButton.Middle) {
                this.control_state = ControlState.ScaleCanvas;
                this.start_scale_canvas = new Vector2D(x, y);  // remember where we click the middle mouse
                const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
                this.start_scale_world = canvas_to_world_tfm.apply(this.start_scale_canvas);
                const s = this.world_to_canvas_tfm.get_scale();
                this.start_scale_camera = s.get_x();  // start camera scale at click moment
            }
        } else if (this.active_tool == Tool.WallDraw) {
            if (button == MouseButton.Left) {
                if (this.potential_point_do_add) {
                    this.room.add_wall_point(this.potential_point_do_add);
                    this.potential_point_do_add = null;

                    this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
                    this.on_room_update();
                }
            } else if (button == MouseButton.Right) {
                if (this.room.get_draw_mode() == RoomConstructMode.None) {
                    // if we in neutral mode and click right button
                    // we can delete the vertex if the mouse over the path vertex
                    // check it
                    const index = this._get_room_point_index(x, y);
                    const wall_index = this.room.convert_index_to_wall_index(index);
                    // in wall mode we should delete only if the index corresponds to walls
                    if (index >= 0 && wall_index >= 0) {
                        const is_delete = this.room.delete_indices([index]);
                        // reset selection (if it was non-trivial)
                        this.selected_indices.length = 0;
                        this.on_room_update();
                    }
                }
                this.room.reset_draw_mode();
                this.potential_point_do_add = null;
                this.update_tools();
                this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            }
        } else if (this.active_tool == Tool.PointDraw) {
            if (button == MouseButton.Left) {
                if (mod == KeyboardModification.Alt) {
                    const index = this._get_room_point_index(x, y);
                    const point_index = this.room.convert_index_to_point_index(index);
                    if (point_index >= 0) {
                        this.control_state = ControlState.RotatePoint;
                    }
                } else {
                    if (this.potential_point_do_add) {
                        this.room.add_point_point(this.potential_point_do_add);
                        this.potential_point_do_add = null;

                        this.control_state = ControlState.RotatePoint;

                        this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
                        this.on_room_update();
                    }
                    // NOTE: no move in active draw tool
                    // we does not move vertices when draw it, so, no reason to move points in this mode
                    // yes, we can rotate it, but for move we should use select tool
                }
            } else if (button == MouseButton.Right) {
                this.potential_point_do_add = null;
                const index = this._get_room_point_index(x, y);
                const point_index = this.room.convert_index_to_point_index(index);
                if (index >= 0 && point_index >= 0) {
                    this.room.delete_indices([index]);
                    this.selected_indices.length = 0;
                    this.on_room_update();
                }

                this.update_tools();
                this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            }
        } else if (this.active_tool == Tool.ZoneDraw) {
            if (button == MouseButton.Left) {
                if (mod == KeyboardModification.Alt) {
                    const index = this._get_room_point_index(x, y);
                    // if (x, y) not in the neighbourhood of the some point, then return -1
                    // here we define inner click zone index and return it
                    const zone_index = this.room.convert_index_to_zone_index(index);
                    if (zone_index >= 0) {
                        this.control_state = ControlState.ScaleZone;
                    }
                } else {
                    // click zone tool with modifications - start creating
                    if (this.potential_point_do_add) {
                        this.room.add_zone_point(this.potential_point_do_add);
                        this.potential_point_do_add = null;

                        this.control_state = ControlState.ScaleZone;

                        this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
                        this.on_room_update();
                    }
                }
            } else if (button == MouseButton.Right) {
                this.potential_point_do_add = null;
                const index = this._get_room_point_index(x, y);
                const zone_index = this.room.convert_index_to_zone_index(index);
                if (index >= 0 && zone_index >= 0) {
                    this.room.delete_indices([index]);
                    this.selected_indices.length = 0;
                    this.on_room_update();
                }

                this.update_tools();
                this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            }
        } else if (this.active_tool == Tool.ConnectionDraw) {
            if (button == MouseButton.Left) {
                if (this.potential_point_do_add) {
                    this.room.add_connection_point(this.potential_point_do_add);
                    this.potential_point_do_add = null;

                    this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
                    this.on_room_update();
                }
            } else if (button == MouseButton.Right) {
                // when we click right mouse button in draw connection mode
                // we can do one of the following:
                // - if we click over connection edge or point - remove corresponding connection
                // - if we click on some other empty space, then finish to draw connection, reset the first point (if it exists)
                
                const is_reset = this.room.reset_connection_draw();
                if (!is_reset) {
                    // may be me point over already created connection
                    // so, we should try to delete some of them
                    const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
                    const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);
                    const is_remove = this.room.remove_connection_at_point(world_pos);
                    if (is_remove) {
                        // reassign potential point
                        const int_world_position = round_position_to_grid(world_pos.get_x(), world_pos.get_y(), 1.0);
                        if (this.room.is_valid_point(int_world_position, this.active_tool, false)) {
                            this.potential_point_do_add = int_world_position;
                        } else {
                            this.potential_point_do_add = null;
                        }
                    }
                }

                this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
                this.on_room_update();
            }
        } else if (this.active_tool == Tool.DoorDraw) {
            if (button == MouseButton.Left) {
                if (mod == KeyboardModification.Alt) {
                    const index = this._get_room_point_index(x, y);
                    const door_index = this.room.convert_index_to_door_index(index);
                    if (door_index >= 0) {
                        this.control_state = ControlState.DirectDoor;
                    }
                } else {
                    if (this.potential_point_do_add) {
                        this.room.add_door_center(this.potential_point_do_add);
                        this.potential_point_do_add = null;

                        this.control_state = ControlState.DirectDoor;

                        this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
                        this.on_room_update();
                    }
                }
            } else if (button == MouseButton.Right) {
                this.potential_point_do_add = null;
                const index = this._get_room_point_index(x, y);
                const door_index = this.room.convert_index_to_door_index(index);
                if (index >= 0 && door_index >= 0) {
                    this.room.delete_indices([index]);
                    this.selected_indices.length = 0;
                    this.on_room_update();
                }

                this.update_tools();
                this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            }
        }
    }

    private on_mouse_release(button: MouseButton, mod: KeyboardModification) {
        if (this.control_state == ControlState.Select && button == MouseButton.Left) {
            this.control_state = ControlState.Idle;

            // here we should execute the select logic
            // get world coordinates ofr the start and end of the selected area
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            // we use remembered start point on canvas, and current mouse position as end point
            const start_world = canvas_to_world_tfm.apply(this.start_select_canvas);
            const end_world = canvas_to_world_tfm.apply(this.current_mouse_position);
            const new_selected_indices = this.room.get_selected_indices(new AABB(start_world, end_world));

            if (mod == KeyboardModification.Shift) {
                // add new selection to the existed one
                for (let i = 0; i < new_selected_indices.length; i++) {
                    const v = new_selected_indices[i];
                    if (!this.selected_indices.includes(v) && this._is_index_agreed_step_size(v, this.selected_indices)) {
                        this.selected_indices.push(v);
                    }
                }
            } else {
                this.selected_indices.length = 0;
                for (let i = 0; i < new_selected_indices.length; i++) {
                    if (this._is_index_agreed_step_size(new_selected_indices[i], this.selected_indices)) {
                        this.selected_indices.push(new_selected_indices[i]);
                    }
                }
            }
            this.update_canvas();
        } else if (this.control_state == ControlState.MovePoints) {
            this.control_state = ControlState.Idle;
            this.click_move_vertex_index = 0;
            this.click_move_selected_vectors.clear();
        } else if (this.control_state == ControlState.MoveCanvas && button == MouseButton.Left) {
            // deactivate move canvas state
            this.control_state = ControlState.Idle;
        } else if (this.control_state == ControlState.ScaleCanvas && button == MouseButton.Middle) {
            // also reset to idle mode
            this.control_state = ControlState.Idle;
        } else if (this.control_state == ControlState.RotatePoint) {
            this.control_state = ControlState.Idle;
            this.room.reset_click_point();
        } else if (this.control_state == ControlState.ScaleZone) {
            this.control_state = ControlState.Idle;
            this.room.reset_click_zone();
        } else if (this.control_state == ControlState.DirectDoor) {
            this.control_state = ControlState.Idle;
            this.room.reset_click_door();
        }
    }

    private on_mouse_move(x: number, y: number) {
        this.current_mouse_position.set_values(x, y);

        if (this.active_tool == Tool.Select) {
            this.on_mouse_move_select(x, y);
        } else if (this.active_tool == Tool.Camera) {
            this.on_mouse_move_camera(x, y);
        } else if (this.active_tool == Tool.WallDraw || this.active_tool == Tool.PointDraw || this.active_tool == Tool.ZoneDraw || this.active_tool == Tool.ConnectionDraw || this.active_tool == Tool.DoorDraw) {
            this.on_mouse_move_draw(x, y);
        }
    }

    private on_mouse_move_select(x: number, y: number) {
        if (this.control_state == ControlState.Select) {
            this.update_canvas(UpdateCanvasMode.OnlySelect);
        } else if (this.control_state == ControlState.MovePoints) {
            // calculate on-grid world position over mouse cursor
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const cursor_world = canvas_to_world_tfm.apply_coordinates(x, y);
            // make position integer
            // cell size for snapping defined by controlled index
            // if it wall or connection - then 1.0, if it room item (point, zone, door) - 0.5
            const step_type = this._index_to_step_type(this.click_move_vertex_index);
            const cell_size = step_type == ItemStepType.Integer ? 1.0 : 0.5;
            const cursor_world_int = round_position_to_grid(cursor_world.get_x(), cursor_world.get_y(), cell_size);
            this.room.move_vertices(this.click_move_vertex_index, cursor_world_int, this.click_move_selected_vectors, step_type);

            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        } else if (this.control_state == ControlState.RotatePoint) {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);

            this.room.define_click_point_angle(world_pos);
            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        } else if (this.control_state == ControlState.ScaleZone) {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);

            this.room.define_click_zone_radius(world_pos);
            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        } else if (this.control_state == ControlState.DirectDoor) {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);

            // snap to 0.5-grid
            const cell_size = 0.5;
            const world_pos_snap = round_position_to_grid(world_pos.get_x(), world_pos.get_y(), cell_size);

            this.room.define_click_door_direction(world_pos_snap);
            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        }
    }

    private on_mouse_move_camera(x: number, y: number) {
        if (this.control_state == ControlState.MoveCanvas) {
            if (false && (x >= this.canvas_width || x <= 0 || y >= this.canvas_height || y <= 0)) {
                // when mouse away from the canvas, reset the state
                this.control_state = ControlState.Idle;
            } else {
                // when we drag the camera, we should calculate the vector from start canvas position to current mouse position
                // then apply transform from screen to camera world
                // finally, move the camera along this vector
                // get canvas shift vector
                const canvas_shift = new Vector2D(x - this.start_move_canvas.get_x(), y - this.start_move_canvas.get_y());
                // calculate direction in world space
                const camera_shift = new Vector2D(canvas_shift.get_x() * MOVE_CAMERA_SPEED, canvas_shift.get_y() * MOVE_CAMERA_SPEED);
                // apply new camera position
                this.world_to_canvas_tfm.set_position_coords(this.start_move_camera.get_x() + camera_shift.get_x(), this.start_move_camera.get_y() + camera_shift.get_y());

                this.update_canvas();
            }
        } else if (this.control_state == ControlState.ScaleCanvas) {
            // get shift in canvas space
            const canvas_shift = new Vector2D(x - this.start_scale_canvas.get_x(), y - this.start_scale_canvas.get_y());
            // convert camera scale with respect to the shift
            // use only vertical shift of the cursor
            const new_camera_scale = Math.exp(canvas_shift.get_y() * SCALE_CAMERA_SPEED) * this.start_scale_camera;
            if (new_camera_scale > SCALE_CAMERA_MINIMUM) {
                const new_position = new Vector2D(this.start_scale_canvas.get_x() - new_camera_scale * this.start_scale_world.get_x(),
                                                  this.start_scale_canvas.get_y() + new_camera_scale * this.start_scale_world.get_y());
                this.world_to_canvas_tfm.set_position_coords(new_position.get_x(), new_position.get_y());
                this.world_to_canvas_tfm.set_scale_values(new_camera_scale, -new_camera_scale);
            }
        }
            
        this.update_canvas();
    }

    private on_mouse_move_draw(x: number, y: number) {
        // calculate corresponding world position
        if (this.active_tool == Tool.PointDraw && this.control_state == ControlState.RotatePoint) {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);

            this.room.define_click_point_angle(world_pos);
            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        } else if (this.active_tool == Tool.ZoneDraw && this.control_state == ControlState.ScaleZone) {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);

            this.room.define_click_zone_radius(world_pos);
            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        } else if (this.active_tool == Tool.DoorDraw && this.control_state == ControlState.DirectDoor) {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);

            const cell_size = 0.5;
            const world_pos_snap = round_position_to_grid(world_pos.get_x(), world_pos.get_y(), cell_size);

            this.room.define_click_door_direction(world_pos_snap);
            this.update_canvas(UpdateCanvasMode.OnlyBlueprint);
            this.on_room_update();
        } else {
            const canvas_to_world_tfm = this.world_to_canvas_tfm.get_inverse();
            const world_pos = canvas_to_world_tfm.apply_coordinates(x, y);
            const int_world_position = round_position_to_grid(world_pos.get_x(), world_pos.get_y(), 
                (this.active_tool == Tool.PointDraw || this.active_tool == Tool.ZoneDraw || this.active_tool == Tool.DoorDraw) ? 0.5 : 1.0);  // snap to x.5 for points,a dn to x.0 for all other tools

            if (this.room.is_valid_point(int_world_position, this.active_tool)) {
                this.potential_point_do_add = int_world_position;
            } else {
                this.potential_point_do_add = null;
            }

            this.update_canvas(UpdateCanvasMode.SelectAndBlueprint);
        }
    }

    private _frame_aabb(aabb: AABB, target_tfm: Transform) {
        const canvas_zone_width = this.canvas_width - 2 * FRAME_CANVAS_PADDING;
        const canvas_zone_height = this.canvas_height - 2 * FRAME_CANVAS_PADDING;

        const world_zone_width = aabb.get_width();
        const world_zone_height = aabb.get_height();

        const scale = Math.min(canvas_zone_width / world_zone_width, canvas_zone_height / world_zone_height);
        // next calculate camera position
        const scaled_width = scale * world_zone_width;
        const scaled_height = scale * world_zone_height;
        const left = FRAME_CANVAS_PADDING + (canvas_zone_width - scaled_width) / 2;
        const top = FRAME_CANVAS_PADDING + (canvas_zone_height - scaled_height) / 2;

        const position_x = left - scale * aabb.get_min_x();
        const position_y = top + scale * aabb.get_max_y();

        target_tfm.set_position_coords(position_x, position_y);
        target_tfm.set_scale_values(scale, -scale);
    }

    private on_change_tool(prev_tool: Tool, next_tool: Tool) {
        if (prev_tool == next_tool) {
            return;
        }

        if (prev_tool == Tool.ConnectionDraw) {
            this.room.reset_connection_draw();
        } else if (prev_tool == Tool.WallDraw) {
            this.room.reset_draw_mode();
        }

        // reset selected indices
        if (next_tool != Tool.Select && next_tool != Tool.Camera) {
            this.selected_indices.length = 0;
        }
    }

    private on_keypress(key: string) {
        if (key == ACTIVATE_CAMERA_TOOL_KEY) {
            this.previous_tool = this.active_tool;
            this.active_tool = Tool.Camera;
            this.press_camera_tool_time = Date.now();
            this.update_tools();
        } else if (key == ACTIVATE_SELECT_TOOL_KEY) {
            this.on_change_tool(this.active_tool, Tool.Select);
            this.active_tool = Tool.Select;
            this.control_state = ControlState.Idle;
            this.update_tools();
        } else if (key == ACTIVATE_DRAW_WALL_TOOL_KEY) {
            this.on_change_tool(this.active_tool, Tool.WallDraw);
            this.active_tool = Tool.WallDraw;
            this.update_tools();
        } else if (key == ACTIVATE_DRAW_POINT_TOOL_KEY) {
            this.on_change_tool(this.active_tool, Tool.PointDraw);
            this.active_tool = Tool.PointDraw;
            this.update_tools();
        } else if (key == ACTIVATE_DRAW_ZONE_TOOL_KEY) {
            this.on_change_tool(this.active_tool, Tool.ZoneDraw);
            this.active_tool = Tool.ZoneDraw;
            this.update_tools();
        } else if (key == ACTIVATE_DRAW_CONNECTION_TOOL_KEY) {
            this.on_change_tool(this.active_tool, Tool.ConnectionDraw);
            this.active_tool = Tool.ConnectionDraw;
            this.update_tools();
        } else if (key == ACTIVATE_DRAW_DOOR_TOOL_KEY) {
            this.on_change_tool(this.active_tool, Tool.DoorDraw);
            this.active_tool = Tool.DoorDraw;
            this.update_tools();
        } else if (key == DELETE_COMMAND) {
            if (this.active_tool == Tool.Select) {
                // call delete in select mode
                const is_delete = this.room.delete_indices(this.selected_indices);
                // reset selection
                this.selected_indices.length = 0;
                this.on_room_update();
            }
        } else if (key == FRAME_ALL_COMMAND) {
            // framing only with select or draw tool
            if (this.active_tool == Tool.Select || this.active_tool == Tool.WallDraw) {
                // get bounding box for all vertices from the room
                const aabb = this.room.get_aabb(FRAME_WORLD_PADDING);
                this._frame_aabb(aabb, this.world_to_canvas_tfm);
            }
        } else if (key == FRAME_COMMAND) {
            // frame selection only with select tool
            // on draw tool no selections
            if (this.active_tool == Tool.Select) {
                if (this.selected_indices.length > 0) {
                    const aabb = this.room.get_aabb(FRAME_WORLD_PADDING, this.selected_indices);
                    this._frame_aabb(aabb, this.world_to_canvas_tfm);
                }
            }
        }

        this.update_canvas();
    }

    private on_keyup(key: string) {
        if (key == ACTIVATE_CAMERA_TOOL_KEY && this.active_tool == Tool.Camera) {
            const current_time = Date.now();
            if (current_time - this.press_camera_tool_time < SWITCH_CAMERA_TOOL_TIME) {
                // activate camera tool as permanent tool
                this.previous_tool = this.active_tool;
                this.potential_point_do_add = null;
                this.room.reset_draw_mode();
                this.update_tools();
                // clear selected indices
                this.selected_indices.length = 0;
                this.update_canvas();
            } else {
                this.active_tool = this.previous_tool;
                this.update_tools();
            }
        }
    }

    private update_canvas(update_mode: UpdateCanvasMode = UpdateCanvasMode.All) {
        this.select_canvas.define_context(this.control_state, this.active_tool, this.world_to_canvas_tfm);
        this.background_canvas.define_context(this.control_state, this.active_tool, this.world_to_canvas_tfm);
        this.blueprint_canvas.define_context(this.control_state, this.active_tool, this.world_to_canvas_tfm);

        // set specific data
        this.select_canvas.define_select_context(this.current_mouse_position, this.potential_point_do_add);
        this.blueprint_canvas.define_blueprint_context(this.room, this.potential_point_do_add, this.selected_indices);

        if (update_mode == UpdateCanvasMode.All) {
            this.background_canvas.update();
            this.blueprint_canvas.update();
            this.select_canvas.update();
        } else if (update_mode == UpdateCanvasMode.OnlyBack) {
            this.background_canvas.update();
        } else if (update_mode == UpdateCanvasMode.OnlyBlueprint) {
            this.blueprint_canvas.update();
        } else if (update_mode == UpdateCanvasMode.OnlySelect) {
            this.select_canvas.update();
        } else if (update_mode == UpdateCanvasMode.SelectAndBlueprint) {
            // this.update_select_canvas();
            this.select_canvas.update();
            this.blueprint_canvas.update();
        }

        if (update_mode == UpdateCanvasMode.All ||
            update_mode == UpdateCanvasMode.OnlyBlueprint ||
            update_mode == UpdateCanvasMode.SelectAndBlueprint) {
            // if we update canvas with the room, and this room is closed
            // we should additionally update select canvas
            // if the path is closed, then we should redraw select canvas, to clear potential point
            this.select_canvas.update();
        }
    }

    private update_tools() {
        this.tool_button_select.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;
        this.tool_button_draw.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;
        this.tool_button_camera.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;
        this.tool_button_point.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;
        this.tool_button_zone.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;
        this.tool_button_connection.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;
        this.tool_button_door.className = TOOL_CLASS + " " + TOOL_NONACTIVE_CLASS;

        if (this.active_tool == Tool.Select) {
            this.tool_button_select.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
            this.potential_point_do_add = null;
            this.room.reset_draw_mode();
        } else if (this.active_tool == Tool.WallDraw) {
            this.tool_button_draw.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
            this.on_mouse_move_draw(this.current_mouse_position.get_x(), this.current_mouse_position.get_y());
            // reset selected indices array
            this.selected_indices.length = 0;
        } else if (this.active_tool == Tool.PointDraw) {
            this.tool_button_point.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
            this.on_mouse_move_draw(this.current_mouse_position.get_x(), this.current_mouse_position.get_y());
        } else if (this.active_tool == Tool.ZoneDraw) {
            this.tool_button_zone.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
            this.on_mouse_move_draw(this.current_mouse_position.get_x(), this.current_mouse_position.get_y());
        } else if (this.active_tool == Tool.ConnectionDraw) {
            this.tool_button_connection.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
            this.on_mouse_move_draw(this.current_mouse_position.get_x(), this.current_mouse_position.get_y());
        } else if (this.active_tool == Tool.DoorDraw) {
            this.tool_button_door.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
            this.on_mouse_move_draw(this.current_mouse_position.get_x(), this.current_mouse_position.get_y());
        } else if (this.active_tool == Tool.Camera) {
            this.tool_button_camera.className = TOOL_CLASS + " " + TOOL_ACTIVE_CLASS;
        }
    }

    private on_new_level() {
        const new_id = this.rooms_store_list.size == 0 ? 0 : (Math.max(...this.rooms_store_list.keys()) + 1);
        this.room = new RoomConstructor(new_id);
        this.world_to_canvas_tfm.set_position_coords(this.canvas_width / 2, this.canvas_height / 2);
        this.world_to_canvas_tfm.set_scale_values(START_CAMERA_SCALE, -START_CAMERA_SCALE);
        this.update_canvas();
        this.on_room_update();
        this.activate_load_level_button(new_id);
    }

    private activate_load_level_button(room_id: number) {
        for (const [btn_id, btn] of this.load_buttons) {
            if (btn_id == room_id) {
                btn.classList.add("locked");
            }
            else {
                btn.classList.remove("locked");
            }
        }
    }

    private on_delete_level_button(id: number) {
        const room_store = this.rooms_store_list.get(id);
        if (room_store) {
            let should_delete = true;
            if (!room_store.is_empty()) {
                if (!confirm("Delete the level?")) {
                    should_delete = false;
                }
            }

            if (should_delete) {
                if (this.room.get_id() == id) {
                    // if current room is the same as delete
                    // delete it and create the new one
                    this.on_new_level();
                }
                // and delete the button and clear the array for store
                const plate = this.load_plates.get(id);
                if (plate) {
                    plate.remove();
                }
                this.rooms_store_list.delete(id);
                delete_room(id);
            }
        }
    }

    private on_load_level(id: number) {
        const room_store = this.rooms_store_list.get(id);
        this.active_tool = Tool.Select;
        this.update_tools();
        if (room_store) {
            const id = room_store.get_id();
            this.activate_load_level_button(id);

            this.room = new RoomConstructor(room_store.get_id());

            // add points one by one
            for (let i = 0; i < room_store.get_closed_count(); i++) {
                const cycle = room_store.get_closed(i);
                for (let j = 0; j < cycle.length; j++) {
                    this.room.add_wall_point(cycle[j]);
                }
                this.room.add_wall_point(cycle[0]);
            }

            const constructed = room_store.get_constructed();
            for (let i = 0; i < constructed.length; i++) {
                this.room.add_wall_point(constructed[i]);
            }

            this.room.reset_draw_mode();

            this.room.add_points(room_store.get_points());
            this.room.add_zones(room_store.get_zones());
            this.room.add_connections(room_store.get_connections());
            this.room.add_doors(room_store.get_doors());
            
            if (!this.room.is_empty()) {
                const aabb = this.room.get_aabb(FRAME_WORLD_PADDING);
                this._frame_aabb(aabb, this.world_to_canvas_tfm);
            }

            this.selected_indices.length = 0;

            this.update_canvas();

            const name_input = this.right_pannel.querySelector("#" + SETTINGS_ROOM_NAME_ID) as HTMLInputElement;
            const collection_input = this.right_pannel.querySelector("#" + SETTINGS_ROOM_COLLECTION_ID) as HTMLInputElement;
            name_input.value = room_store.get_name();
            collection_input.value = room_store.get_collections().join(" ");
        }
    }

    private on_room_update() {
        const temp_tfm = new Transform();
        const aabb = this.room.get_aabb(FRAME_WORLD_PADDING);
        this._frame_aabb(aabb, temp_tfm);

        if (!this.render_canvas) {
            this.render_canvas = document.createElement("canvas");
            this.render_canvas.width = PREVIEW_LEVEL_WIDTH;
            this.render_canvas.height = PREVIEW_LEVEL_HEIGHT;
            this.render_ctx = this.render_canvas.getContext("2d")!;
        }

        if (this.render_ctx) {
            this.render_ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.render_ctx.clearRect(0, 0, PREVIEW_LEVEL_WIDTH, PREVIEW_LEVEL_HEIGHT);
            const fit_scale = Math.min(PREVIEW_LEVEL_WIDTH / this.canvas_width, PREVIEW_LEVEL_HEIGHT / this.canvas_height);
            const scaled_width = this.canvas_width * fit_scale;
            const scaled_height = this.canvas_height * fit_scale;
            const offset_x = (PREVIEW_LEVEL_WIDTH - scaled_width) / 2;
            const offset_y = (PREVIEW_LEVEL_HEIGHT - scaled_height) / 2;
            this.render_ctx.translate(offset_x, offset_y);
            this.render_ctx.scale(fit_scale, fit_scale);
            this.blueprint_canvas.draw(this.render_ctx, temp_tfm, true);

            const preview_img = this.render_canvas.toDataURL('image/png');
            const room_id = this.room.get_id();

            let room_store = this.rooms_store_list.get(room_id);
            const room_button = this.load_buttons.get(room_id);
            if (room_store && room_button) {
                room_store.update_content(this.room.get_closed_cycles(),
                                          this.room.get_constructed_cycle(),
                                          preview_img,
                                          this.room.get_points(),
                                          this.room.get_zones(),
                                          this.room.get_connections(),
                                          this.room.get_doors());
                room_button.style.backgroundImage = `url(${preview_img})`;
            } else {
                const name_input = this.right_pannel.querySelector("#" + SETTINGS_ROOM_NAME_ID) as HTMLInputElement;
                const collection_input = this.right_pannel.querySelector("#" + SETTINGS_ROOM_COLLECTION_ID) as HTMLInputElement;

                const new_store = new RoomStore(this.room.get_closed_cycles(),
                                                this.room.get_constructed_cycle(),
                                                room_id,
                                                preview_img,
                                                name_input.value,
                                                collection_input.value,
                                                this.room.get_points(),
                                                this.room.get_zones(),
                                                this.room.get_connections(),
                                                this.room.get_doors());
                this.rooms_store_list.set(room_id, new_store);

                this._add_level_button_to_left_pannel(false, new_store.get_name(), room_id, preview_img);
            }
            // and next store in the db
            room_store = this.rooms_store_list.get(room_id);
            if (room_store) {
                save_room(room_store);
            }
        }
    }
}