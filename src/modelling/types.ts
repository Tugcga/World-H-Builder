export enum MouseButton {
    Left,
    Right,
    Middle,
    Unknown
}

export enum KeyboardModification {
    Unknown,
    Shift,
    Alt
}

export enum Tool {
    Select,
    WallDraw,
    Camera,
    PointDraw,
    ZoneDraw,
    ConnectionDraw,
    DoorDraw
}

export enum ControlState {
    Idle,
    MoveCanvas,
    ScaleCanvas,
    Select,
    MovePoints,
    RotatePoint,
    ScaleZone,
    DirectDoor
}

export enum UpdateCanvasMode {
    All,
    OnlySelect,
    OnlyBlueprint,
    OnlyBack,
    SelectAndBlueprint
}

export enum RoomConstructMode {
    None,
    DrawWalls
}

export enum RoomConstructDirection {
    Head,
    Tail
}

export enum ItemStepType {
    Integer,
    Half
}
