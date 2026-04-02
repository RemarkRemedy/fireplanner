export type ChartBarRadius = [number, number, number, number]

const ILP_BAR_CORNER_RADIUS = 8

export const ILP_VERTICAL_BAR_RADIUS: ChartBarRadius = [ILP_BAR_CORNER_RADIUS, ILP_BAR_CORNER_RADIUS, 0, 0]
export const ILP_VERTICAL_NEGATIVE_BAR_RADIUS: ChartBarRadius = [0, 0, ILP_BAR_CORNER_RADIUS, ILP_BAR_CORNER_RADIUS]
export const ILP_HORIZONTAL_BAR_RADIUS: ChartBarRadius = [0, ILP_BAR_CORNER_RADIUS, ILP_BAR_CORNER_RADIUS, 0]
