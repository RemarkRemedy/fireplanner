// Singapore Complete Life Tables 2023-2024
// Source: Singapore Department of Statistics
// Publication: "Complete Life Tables for Singapore Resident Population, 2023-2024" (May 2025)
// Data file: lifetable2003-2024.csv (extracted from lifetable2003-2024.ashx ZIP)
// URL: https://www.singstat.gov.sg/publications/population/complete-life-table
// Downloaded: 2026-02-27
//
// Methodology: Period life table (not cohort). Based on age-specific mortality rates
// averaged over 2022-2024 (3-year rolling average to smooth fluctuations).
// 2024 death rates are preliminary, based on 2023 and 2024 data.
// Note: Life expectancy data for 2020-2023 were affected by COVID-19 elevated
// mortality; 2024 data reflects more normal conditions.
//
// Table structure:
//   age  - exact age x in years; 100 = "100 and over" (open interval)
//   qx   - probability of dying between exact ages x and x+1
//   lx   - number of survivors at exact age x (radix = 100,000 at age 0)
//   dx   - number of deaths between exact ages x and x+1
//   Lx   - person-years lived between exact ages x and x+1
//   Tx   - total person-years lived after exact age x
//   ex   - life expectancy (expected additional years of life) at exact age x
//
// Life expectancy at birth: Males 81.2 yrs, Females 85.6 yrs, Total 83.5 yrs
// Life expectancy at age 65: Males 19.5 yrs, Females 22.7 yrs, Total 21.2 yrs

export interface LifeTableRow {
  age: number;   // exact age x; 100 represents the "100 and over" open interval
  qx: number;   // probability of dying between age x and x+1
  lx: number;   // survivors at age x (out of 100,000 born)
  dx: number;   // deaths between age x and x+1
  Lx: number;   // person-years lived between age x and x+1
  Tx: number;   // total person-years lived after age x
  ex: number;   // life expectancy at age x (years)
}

// Male life table -- 2024 (preliminary)
export const maleLifeTable2024: LifeTableRow[] = [
  { age:   0, qx: 0.00190, lx: 100000, dx:   190, Lx:  99840, Tx:   8123423, ex: 81.2 },
  { age:   1, qx: 0.00014, lx:  99810, dx:    14, Lx:  99803, Tx:   8023582, ex: 80.4 },
  { age:   2, qx: 0.00013, lx:  99796, dx:    13, Lx:  99790, Tx:   7923779, ex: 79.4 },
  { age:   3, qx: 0.00012, lx:  99783, dx:    12, Lx:  99777, Tx:   7823990, ex: 78.4 },
  { age:   4, qx: 0.00011, lx:  99771, dx:    11, Lx:  99766, Tx:   7724213, ex: 77.4 },
  { age:   5, qx: 0.00009, lx:  99760, dx:     9, Lx:  99756, Tx:   7624447, ex: 76.4 },
  { age:   6, qx: 0.00008, lx:  99751, dx:     8, Lx:  99747, Tx:   7524692, ex: 75.4 },
  { age:   7, qx: 0.00007, lx:  99743, dx:     7, Lx:  99740, Tx:   7424945, ex: 74.4 },
  { age:   8, qx: 0.00008, lx:  99736, dx:     8, Lx:  99732, Tx:   7325205, ex: 73.4 },
  { age:   9, qx: 0.00008, lx:  99728, dx:     8, Lx:  99724, Tx:   7225473, ex: 72.5 },
  { age:  10, qx: 0.00009, lx:  99720, dx:     9, Lx:  99716, Tx:   7125749, ex: 71.5 },
  { age:  11, qx: 0.00010, lx:  99711, dx:    10, Lx:  99706, Tx:   7026034, ex: 70.5 },
  { age:  12, qx: 0.00012, lx:  99701, dx:    12, Lx:  99695, Tx:   6926328, ex: 69.5 },
  { age:  13, qx: 0.00014, lx:  99689, dx:    14, Lx:  99682, Tx:   6826633, ex: 68.5 },
  { age:  14, qx: 0.00017, lx:  99675, dx:    17, Lx:  99667, Tx:   6726951, ex: 67.5 },
  { age:  15, qx: 0.00019, lx:  99658, dx:    19, Lx:  99649, Tx:   6627284, ex: 66.5 },
  { age:  16, qx: 0.00022, lx:  99639, dx:    22, Lx:  99628, Tx:   6527636, ex: 65.5 },
  { age:  17, qx: 0.00025, lx:  99617, dx:    25, Lx:  99605, Tx:   6428008, ex: 64.5 },
  { age:  18, qx: 0.00027, lx:  99592, dx:    27, Lx:  99579, Tx:   6328403, ex: 63.5 },
  { age:  19, qx: 0.00030, lx:  99565, dx:    30, Lx:  99550, Tx:   6228825, ex: 62.6 },
  { age:  20, qx: 0.00033, lx:  99535, dx:    33, Lx:  99519, Tx:   6129275, ex: 61.6 },
  { age:  21, qx: 0.00036, lx:  99502, dx:    36, Lx:  99484, Tx:   6029756, ex: 60.6 },
  { age:  22, qx: 0.00038, lx:  99466, dx:    38, Lx:  99447, Tx:   5930272, ex: 59.6 },
  { age:  23, qx: 0.00039, lx:  99428, dx:    39, Lx:  99409, Tx:   5830825, ex: 58.6 },
  { age:  24, qx: 0.00041, lx:  99389, dx:    40, Lx:  99369, Tx:   5731417, ex: 57.7 },
  { age:  25, qx: 0.00041, lx:  99349, dx:    41, Lx:  99329, Tx:   5632048, ex: 56.7 },
  { age:  26, qx: 0.00042, lx:  99308, dx:    42, Lx:  99287, Tx:   5532719, ex: 55.7 },
  { age:  27, qx: 0.00043, lx:  99266, dx:    43, Lx:  99245, Tx:   5433432, ex: 54.7 },
  { age:  28, qx: 0.00045, lx:  99223, dx:    44, Lx:  99201, Tx:   5334188, ex: 53.8 },
  { age:  29, qx: 0.00046, lx:  99179, dx:    45, Lx:  99157, Tx:   5234987, ex: 52.8 },
  { age:  30, qx: 0.00047, lx:  99134, dx:    46, Lx:  99111, Tx:   5135830, ex: 51.8 },
  { age:  31, qx: 0.00048, lx:  99088, dx:    47, Lx:  99065, Tx:   5036719, ex: 50.8 },
  { age:  32, qx: 0.00049, lx:  99041, dx:    49, Lx:  99017, Tx:   4937655, ex: 49.9 },
  { age:  33, qx: 0.00052, lx:  98992, dx:    51, Lx:  98967, Tx:   4838638, ex: 48.9 },
  { age:  34, qx: 0.00055, lx:  98941, dx:    54, Lx:  98914, Tx:   4739672, ex: 47.9 },
  { age:  35, qx: 0.00058, lx:  98887, dx:    57, Lx:  98859, Tx:   4640758, ex: 46.9 },
  { age:  36, qx: 0.00061, lx:  98830, dx:    60, Lx:  98800, Tx:   4541899, ex: 46.0 },
  { age:  37, qx: 0.00065, lx:  98770, dx:    64, Lx:  98738, Tx:   4443099, ex: 45.0 },
  { age:  38, qx: 0.00071, lx:  98706, dx:    70, Lx:  98671, Tx:   4344361, ex: 44.0 },
  { age:  39, qx: 0.00077, lx:  98636, dx:    76, Lx:  98598, Tx:   4245690, ex: 43.0 },
  { age:  40, qx: 0.00084, lx:  98560, dx:    83, Lx:  98519, Tx:   4147092, ex: 42.1 },
  { age:  41, qx: 0.00091, lx:  98477, dx:    90, Lx:  98432, Tx:   4048574, ex: 41.1 },
  { age:  42, qx: 0.00100, lx:  98387, dx:    98, Lx:  98338, Tx:   3950142, ex: 40.1 },
  { age:  43, qx: 0.00112, lx:  98289, dx:   110, Lx:  98234, Tx:   3851804, ex: 39.2 },
  { age:  44, qx: 0.00125, lx:  98179, dx:   123, Lx:  98118, Tx:   3753570, ex: 38.2 },
  { age:  45, qx: 0.00139, lx:  98056, dx:   137, Lx:  97988, Tx:   3655452, ex: 37.3 },
  { age:  46, qx: 0.00154, lx:  97919, dx:   151, Lx:  97844, Tx:   3557465, ex: 36.3 },
  { age:  47, qx: 0.00170, lx:  97768, dx:   167, Lx:  97685, Tx:   3459621, ex: 35.4 },
  { age:  48, qx: 0.00190, lx:  97601, dx:   185, Lx:  97509, Tx:   3361937, ex: 34.4 },
  { age:  49, qx: 0.00211, lx:  97416, dx:   205, Lx:  97314, Tx:   3264428, ex: 33.5 },
  { age:  50, qx: 0.00232, lx:  97211, dx:   226, Lx:  97098, Tx:   3167115, ex: 32.6 },
  { age:  51, qx: 0.00255, lx:  96985, dx:   247, Lx:  96862, Tx:   3070017, ex: 31.7 },
  { age:  52, qx: 0.00282, lx:  96738, dx:   273, Lx:  96602, Tx:   2973155, ex: 30.7 },
  { age:  53, qx: 0.00315, lx:  96465, dx:   304, Lx:  96313, Tx:   2876554, ex: 29.8 },
  { age:  54, qx: 0.00352, lx:  96161, dx:   339, Lx:  95992, Tx:   2780241, ex: 28.9 },
  { age:  55, qx: 0.00391, lx:  95822, dx:   374, Lx:  95635, Tx:   2684249, ex: 28.0 },
  { age:  56, qx: 0.00431, lx:  95448, dx:   411, Lx:  95243, Tx:   2588614, ex: 27.1 },
  { age:  57, qx: 0.00476, lx:  95037, dx:   453, Lx:  94811, Tx:   2493372, ex: 26.2 },
  { age:  58, qx: 0.00531, lx:  94584, dx:   502, Lx:  94333, Tx:   2398561, ex: 25.4 },
  { age:  59, qx: 0.00590, lx:  94082, dx:   555, Lx:  93805, Tx:   2304228, ex: 24.5 },
  { age:  60, qx: 0.00650, lx:  93527, dx:   608, Lx:  93223, Tx:   2210424, ex: 23.6 },
  { age:  61, qx: 0.00714, lx:  92919, dx:   663, Lx:  92588, Tx:   2117201, ex: 22.8 },
  { age:  62, qx: 0.00788, lx:  92256, dx:   727, Lx:  91893, Tx:   2024613, ex: 21.9 },
  { age:  63, qx: 0.00879, lx:  91529, dx:   804, Lx:  91127, Tx:   1932721, ex: 21.1 },
  { age:  64, qx: 0.00980, lx:  90725, dx:   889, Lx:  90281, Tx:   1841594, ex: 20.3 },
  { age:  65, qx: 0.01084, lx:  89836, dx:   974, Lx:  89349, Tx:   1751313, ex: 19.5 },
  { age:  66, qx: 0.01191, lx:  88862, dx:  1058, Lx:  88333, Tx:   1661964, ex: 18.7 },
  { age:  67, qx: 0.01304, lx:  87804, dx:  1145, Lx:  87232, Tx:   1573631, ex: 17.9 },
  { age:  68, qx: 0.01428, lx:  86659, dx:  1237, Lx:  86041, Tx:   1486400, ex: 17.2 },
  { age:  69, qx: 0.01555, lx:  85422, dx:  1328, Lx:  84758, Tx:   1400359, ex: 16.4 },
  { age:  70, qx: 0.01682, lx:  84094, dx:  1414, Lx:  83387, Tx:   1315601, ex: 15.6 },
  { age:  71, qx: 0.01822, lx:  82680, dx:  1506, Lx:  81927, Tx:   1232214, ex: 14.9 },
  { age:  72, qx: 0.01999, lx:  81174, dx:  1623, Lx:  80363, Tx:   1150287, ex: 14.2 },
  { age:  73, qx: 0.02231, lx:  79551, dx:  1775, Lx:  78664, Tx:   1069925, ex: 13.4 },
  { age:  74, qx: 0.02490, lx:  77776, dx:  1937, Lx:  76808, Tx:    991261, ex: 12.7 },
  { age:  75, qx: 0.02754, lx:  75839, dx:  2089, Lx:  74795, Tx:    914454, ex: 12.1 },
  { age:  76, qx: 0.03041, lx:  73750, dx:  2243, Lx:  72629, Tx:    839659, ex: 11.4 },
  { age:  77, qx: 0.03409, lx:  71507, dx:  2438, Lx:  70288, Tx:    767031, ex: 10.7 },
  { age:  78, qx: 0.03903, lx:  69069, dx:  2696, Lx:  67721, Tx:    696743, ex: 10.1 },
  { age:  79, qx: 0.04472, lx:  66373, dx:  2968, Lx:  64889, Tx:    629022, ex: 9.5 },
  { age:  80, qx: 0.05057, lx:  63405, dx:  3207, Lx:  61802, Tx:    564133, ex: 8.9 },
  { age:  81, qx: 0.05649, lx:  60198, dx:  3401, Lx:  58498, Tx:    502331, ex: 8.3 },
  { age:  82, qx: 0.06292, lx:  56797, dx:  3574, Lx:  55010, Tx:    443834, ex: 7.8 },
  { age:  83, qx: 0.07039, lx:  53223, dx:  3746, Lx:  51350, Tx:    388824, ex: 7.3 },
  { age:  84, qx: 0.07889, lx:  49477, dx:  3903, Lx:  47526, Tx:    337474, ex: 6.8 },
  { age:  85, qx: 0.08801, lx:  45574, dx:  4011, Lx:  43569, Tx:    289948, ex: 6.4 },
  { age:  86, qx: 0.09799, lx:  41563, dx:  4073, Lx:  39527, Tx:    246380, ex: 5.9 },
  { age:  87, qx: 0.10890, lx:  37490, dx:  4083, Lx:  35449, Tx:    206853, ex: 5.5 },
  { age:  88, qx: 0.12077, lx:  33407, dx:  4035, Lx:  31390, Tx:    171405, ex: 5.1 },
  { age:  89, qx: 0.13367, lx:  29372, dx:  3926, Lx:  27409, Tx:    140015, ex: 4.8 },
  { age:  90, qx: 0.14764, lx:  25446, dx:  3757, Lx:  23568, Tx:    112606, ex: 4.4 },
  { age:  91, qx: 0.16272, lx:  21689, dx:  3529, Lx:  19925, Tx:     89039, ex: 4.1 },
  { age:  92, qx: 0.17896, lx:  18160, dx:  3250, Lx:  16535, Tx:     69114, ex: 3.8 },
  { age:  93, qx: 0.19639, lx:  14910, dx:  2928, Lx:  13446, Tx:     52579, ex: 3.5 },
  { age:  94, qx: 0.21504, lx:  11982, dx:  2577, Lx:  10694, Tx:     39133, ex: 3.3 },
  { age:  95, qx: 0.23493, lx:   9405, dx:  2209, Lx:   8301, Tx:     28440, ex: 3.0 },
  { age:  96, qx: 0.25607, lx:   7196, dx:  1843, Lx:   6275, Tx:     20139, ex: 2.8 },
  { age:  97, qx: 0.27846, lx:   5353, dx:  1491, Lx:   4608, Tx:     13865, ex: 2.6 },
  { age:  98, qx: 0.30210, lx:   3862, dx:  1167, Lx:   3279, Tx:      9257, ex: 2.4 },
  { age:  99, qx: 0.32697, lx:   2695, dx:   881, Lx:   2255, Tx:      5979, ex: 2.2 },
  { age: 100, qx: 1.00000, lx:   1814, dx:  1814, Lx:   3724, Tx:      3724, ex: 2.1 },
];

// Female life table -- 2024 (preliminary)
export const femaleLifeTable2024: LifeTableRow[] = [
  { age:   0, qx: 0.00274, lx: 100000, dx:   274, Lx:  99770, Tx:   8556844, ex: 85.6 },
  { age:   1, qx: 0.00011, lx:  99726, dx:    11, Lx:  99721, Tx:   8457074, ex: 84.8 },
  { age:   2, qx: 0.00011, lx:  99715, dx:    11, Lx:  99710, Tx:   8357353, ex: 83.8 },
  { age:   3, qx: 0.00010, lx:  99704, dx:    10, Lx:  99699, Tx:   8257644, ex: 82.8 },
  { age:   4, qx: 0.00009, lx:  99694, dx:     9, Lx:  99690, Tx:   8157945, ex: 81.8 },
  { age:   5, qx: 0.00008, lx:  99685, dx:     8, Lx:  99681, Tx:   8058255, ex: 80.8 },
  { age:   6, qx: 0.00007, lx:  99677, dx:     7, Lx:  99674, Tx:   7958574, ex: 79.8 },
  { age:   7, qx: 0.00006, lx:  99670, dx:     6, Lx:  99667, Tx:   7858901, ex: 78.8 },
  { age:   8, qx: 0.00006, lx:  99664, dx:     6, Lx:  99661, Tx:   7759234, ex: 77.9 },
  { age:   9, qx: 0.00007, lx:  99658, dx:     7, Lx:  99655, Tx:   7659573, ex: 76.9 },
  { age:  10, qx: 0.00008, lx:  99651, dx:     8, Lx:  99647, Tx:   7559918, ex: 75.9 },
  { age:  11, qx: 0.00009, lx:  99643, dx:     9, Lx:  99639, Tx:   7460271, ex: 74.9 },
  { age:  12, qx: 0.00010, lx:  99634, dx:    10, Lx:  99629, Tx:   7360633, ex: 73.9 },
  { age:  13, qx: 0.00012, lx:  99624, dx:    12, Lx:  99618, Tx:   7261004, ex: 72.9 },
  { age:  14, qx: 0.00014, lx:  99612, dx:    14, Lx:  99605, Tx:   7161386, ex: 71.9 },
  { age:  15, qx: 0.00016, lx:  99598, dx:    16, Lx:  99590, Tx:   7061781, ex: 70.9 },
  { age:  16, qx: 0.00018, lx:  99582, dx:    18, Lx:  99573, Tx:   6962191, ex: 69.9 },
  { age:  17, qx: 0.00020, lx:  99564, dx:    19, Lx:  99555, Tx:   6862618, ex: 68.9 },
  { age:  18, qx: 0.00020, lx:  99545, dx:    19, Lx:  99536, Tx:   6763063, ex: 67.9 },
  { age:  19, qx: 0.00019, lx:  99526, dx:    19, Lx:  99517, Tx:   6663528, ex: 67.0 },
  { age:  20, qx: 0.00018, lx:  99507, dx:    17, Lx:  99499, Tx:   6564011, ex: 66.0 },
  { age:  21, qx: 0.00017, lx:  99490, dx:    16, Lx:  99482, Tx:   6464513, ex: 65.0 },
  { age:  22, qx: 0.00016, lx:  99474, dx:    16, Lx:  99466, Tx:   6365031, ex: 64.0 },
  { age:  23, qx: 0.00016, lx:  99458, dx:    16, Lx:  99450, Tx:   6265565, ex: 63.0 },
  { age:  24, qx: 0.00016, lx:  99442, dx:    16, Lx:  99434, Tx:   6166115, ex: 62.0 },
  { age:  25, qx: 0.00016, lx:  99426, dx:    16, Lx:  99418, Tx:   6066681, ex: 61.0 },
  { age:  26, qx: 0.00016, lx:  99410, dx:    16, Lx:  99402, Tx:   5967263, ex: 60.0 },
  { age:  27, qx: 0.00017, lx:  99394, dx:    17, Lx:  99386, Tx:   5867861, ex: 59.0 },
  { age:  28, qx: 0.00018, lx:  99377, dx:    17, Lx:  99369, Tx:   5768475, ex: 58.0 },
  { age:  29, qx: 0.00019, lx:  99360, dx:    19, Lx:  99351, Tx:   5669107, ex: 57.1 },
  { age:  30, qx: 0.00020, lx:  99341, dx:    20, Lx:  99331, Tx:   5569756, ex: 56.1 },
  { age:  31, qx: 0.00022, lx:  99321, dx:    21, Lx:  99311, Tx:   5470425, ex: 55.1 },
  { age:  32, qx: 0.00023, lx:  99300, dx:    23, Lx:  99289, Tx:   5371115, ex: 54.1 },
  { age:  33, qx: 0.00026, lx:  99277, dx:    25, Lx:  99265, Tx:   5271826, ex: 53.1 },
  { age:  34, qx: 0.00028, lx:  99252, dx:    28, Lx:  99238, Tx:   5172562, ex: 52.1 },
  { age:  35, qx: 0.00031, lx:  99224, dx:    30, Lx:  99209, Tx:   5073324, ex: 51.1 },
  { age:  36, qx: 0.00033, lx:  99194, dx:    33, Lx:  99178, Tx:   4974115, ex: 50.1 },
  { age:  37, qx: 0.00037, lx:  99161, dx:    36, Lx:  99143, Tx:   4874937, ex: 49.2 },
  { age:  38, qx: 0.00041, lx:  99125, dx:    40, Lx:  99105, Tx:   4775794, ex: 48.2 },
  { age:  39, qx: 0.00045, lx:  99085, dx:    45, Lx:  99063, Tx:   4676689, ex: 47.2 },
  { age:  40, qx: 0.00050, lx:  99040, dx:    50, Lx:  99015, Tx:   4577627, ex: 46.2 },
  { age:  41, qx: 0.00055, lx:  98990, dx:    54, Lx:  98963, Tx:   4478612, ex: 45.2 },
  { age:  42, qx: 0.00060, lx:  98936, dx:    60, Lx:  98906, Tx:   4379649, ex: 44.3 },
  { age:  43, qx: 0.00066, lx:  98876, dx:    66, Lx:  98843, Tx:   4280743, ex: 43.3 },
  { age:  44, qx: 0.00073, lx:  98810, dx:    72, Lx:  98774, Tx:   4181900, ex: 42.3 },
  { age:  45, qx: 0.00079, lx:  98738, dx:    78, Lx:  98699, Tx:   4083126, ex: 41.4 },
  { age:  46, qx: 0.00086, lx:  98660, dx:    85, Lx:  98618, Tx:   3984427, ex: 40.4 },
  { age:  47, qx: 0.00095, lx:  98575, dx:    93, Lx:  98529, Tx:   3885809, ex: 39.4 },
  { age:  48, qx: 0.00106, lx:  98482, dx:   104, Lx:  98430, Tx:   3787281, ex: 38.5 },
  { age:  49, qx: 0.00118, lx:  98378, dx:   116, Lx:  98320, Tx:   3688851, ex: 37.5 },
  { age:  50, qx: 0.00131, lx:  98262, dx:   129, Lx:  98198, Tx:   3590531, ex: 36.5 },
  { age:  51, qx: 0.00144, lx:  98133, dx:   141, Lx:  98063, Tx:   3492333, ex: 35.6 },
  { age:  52, qx: 0.00159, lx:  97992, dx:   155, Lx:  97915, Tx:   3394271, ex: 34.6 },
  { age:  53, qx: 0.00175, lx:  97837, dx:   171, Lx:  97752, Tx:   3296356, ex: 33.7 },
  { age:  54, qx: 0.00193, lx:  97666, dx:   188, Lx:  97572, Tx:   3198605, ex: 32.8 },
  { age:  55, qx: 0.00211, lx:  97478, dx:   206, Lx:  97375, Tx:   3101033, ex: 31.8 },
  { age:  56, qx: 0.00230, lx:  97272, dx:   223, Lx:  97161, Tx:   3003658, ex: 30.9 },
  { age:  57, qx: 0.00251, lx:  97049, dx:   243, Lx:  96928, Tx:   2906497, ex: 29.9 },
  { age:  58, qx: 0.00276, lx:  96806, dx:   267, Lx:  96673, Tx:   2809570, ex: 29.0 },
  { age:  59, qx: 0.00302, lx:  96539, dx:   292, Lx:  96393, Tx:   2712897, ex: 28.1 },
  { age:  60, qx: 0.00329, lx:  96247, dx:   317, Lx:  96089, Tx:   2616504, ex: 27.2 },
  { age:  61, qx: 0.00358, lx:  95930, dx:   344, Lx:  95758, Tx:   2520416, ex: 26.3 },
  { age:  62, qx: 0.00393, lx:  95586, dx:   376, Lx:  95398, Tx:   2424658, ex: 25.4 },
  { age:  63, qx: 0.00437, lx:  95210, dx:   416, Lx:  95002, Tx:   2329260, ex: 24.5 },
  { age:  64, qx: 0.00487, lx:  94794, dx:   461, Lx:  94564, Tx:   2234258, ex: 23.6 },
  { age:  65, qx: 0.00538, lx:  94333, dx:   507, Lx:  94080, Tx:   2139694, ex: 22.7 },
  { age:  66, qx: 0.00592, lx:  93826, dx:   555, Lx:  93549, Tx:   2045615, ex: 21.8 },
  { age:  67, qx: 0.00654, lx:  93271, dx:   610, Lx:  92966, Tx:   1952066, ex: 20.9 },
  { age:  68, qx: 0.00731, lx:  92661, dx:   677, Lx:  92323, Tx:   1859100, ex: 20.1 },
  { age:  69, qx: 0.00815, lx:  91984, dx:   750, Lx:  91609, Tx:   1766778, ex: 19.2 },
  { age:  70, qx: 0.00902, lx:  91234, dx:   823, Lx:  90823, Tx:   1675169, ex: 18.4 },
  { age:  71, qx: 0.00995, lx:  90411, dx:   899, Lx:  89962, Tx:   1584346, ex: 17.5 },
  { age:  72, qx: 0.01107, lx:  89512, dx:   991, Lx:  89017, Tx:   1494385, ex: 16.7 },
  { age:  73, qx: 0.01247, lx:  88521, dx:  1104, Lx:  87969, Tx:   1405368, ex: 15.9 },
  { age:  74, qx: 0.01399, lx:  87417, dx:  1223, Lx:  86806, Tx:   1317399, ex: 15.1 },
  { age:  75, qx: 0.01553, lx:  86194, dx:  1339, Lx:  85525, Tx:   1230594, ex: 14.3 },
  { age:  76, qx: 0.01726, lx:  84855, dx:  1465, Lx:  84123, Tx:   1145069, ex: 13.5 },
  { age:  77, qx: 0.01965, lx:  83390, dx:  1638, Lx:  82571, Tx:   1060947, ex: 12.7 },
  { age:  78, qx: 0.02299, lx:  81752, dx:  1880, Lx:  80812, Tx:    978376, ex: 12.0 },
  { age:  79, qx: 0.02689, lx:  79872, dx:  2148, Lx:  78798, Tx:    897564, ex: 11.2 },
  { age:  80, qx: 0.03088, lx:  77724, dx:  2400, Lx:  76524, Tx:    818766, ex: 10.5 },
  { age:  81, qx: 0.03503, lx:  75324, dx:  2638, Lx:  74005, Tx:    742242, ex: 9.9 },
  { age:  82, qx: 0.03996, lx:  72686, dx:  2904, Lx:  71234, Tx:    668237, ex: 9.2 },
  { age:  83, qx: 0.04638, lx:  69782, dx:  3236, Lx:  68164, Tx:    597003, ex: 8.6 },
  { age:  84, qx: 0.05425, lx:  66546, dx:  3610, Lx:  64741, Tx:    528839, ex: 7.9 },
  { age:  85, qx: 0.06263, lx:  62936, dx:  3941, Lx:  60966, Tx:    464098, ex: 7.4 },
  { age:  86, qx: 0.07200, lx:  58995, dx:  4247, Lx:  56872, Tx:    403132, ex: 6.8 },
  { age:  87, qx: 0.08242, lx:  54748, dx:  4512, Lx:  52492, Tx:    346261, ex: 6.3 },
  { age:  88, qx: 0.09395, lx:  50236, dx:  4720, Lx:  47876, Tx:    293769, ex: 5.8 },
  { age:  89, qx: 0.10664, lx:  45516, dx:  4854, Lx:  43089, Tx:    245893, ex: 5.4 },
  { age:  90, qx: 0.12052, lx:  40662, dx:  4901, Lx:  38212, Tx:    202804, ex: 5.0 },
  { age:  91, qx: 0.13562, lx:  35761, dx:  4850, Lx:  33336, Tx:    164592, ex: 4.6 },
  { age:  92, qx: 0.15194, lx:  30911, dx:  4696, Lx:  28563, Tx:    131256, ex: 4.2 },
  { age:  93, qx: 0.16947, lx:  26215, dx:  4443, Lx:  23994, Tx:    102693, ex: 3.9 },
  { age:  94, qx: 0.18821, lx:  21772, dx:  4098, Lx:  19723, Tx:     78700, ex: 3.6 },
  { age:  95, qx: 0.20809, lx:  17674, dx:  3678, Lx:  15835, Tx:     58977, ex: 3.3 },
  { age:  96, qx: 0.22908, lx:  13996, dx:  3206, Lx:  12393, Tx:     43142, ex: 3.1 },
  { age:  97, qx: 0.25107, lx:  10790, dx:  2709, Lx:   9436, Tx:     30749, ex: 2.8 },
  { age:  98, qx: 0.27400, lx:   8081, dx:  2214, Lx:   6974, Tx:     21313, ex: 2.6 },
  { age:  99, qx: 0.29773, lx:   5867, dx:  1747, Lx:   4994, Tx:     14339, ex: 2.4 },
  { age: 100, qx: 1.00000, lx:   4120, dx:  4120, Lx:   9346, Tx:      9346, ex: 2.3 },
];

// Total (residents) life table -- 2024 (preliminary)
export const totalLifeTable2024: LifeTableRow[] = [
  { age:   0, qx: 0.00234, lx: 100000, dx:   234, Lx:  99803, Tx:   8345980, ex: 83.5 },
  { age:   1, qx: 0.00012, lx:  99766, dx:    12, Lx:  99760, Tx:   8246176, ex: 82.7 },
  { age:   2, qx: 0.00012, lx:  99754, dx:    12, Lx:  99748, Tx:   8146416, ex: 81.7 },
  { age:   3, qx: 0.00011, lx:  99742, dx:    11, Lx:  99737, Tx:   8046668, ex: 80.7 },
  { age:   4, qx: 0.00010, lx:  99731, dx:    10, Lx:  99726, Tx:   7946932, ex: 79.7 },
  { age:   5, qx: 0.00008, lx:  99721, dx:     8, Lx:  99717, Tx:   7847206, ex: 78.7 },
  { age:   6, qx: 0.00007, lx:  99713, dx:     7, Lx:  99710, Tx:   7747489, ex: 77.7 },
  { age:   7, qx: 0.00007, lx:  99706, dx:     7, Lx:  99703, Tx:   7647779, ex: 76.7 },
  { age:   8, qx: 0.00007, lx:  99699, dx:     7, Lx:  99696, Tx:   7548077, ex: 75.7 },
  { age:   9, qx: 0.00008, lx:  99692, dx:     8, Lx:  99688, Tx:   7448381, ex: 74.7 },
  { age:  10, qx: 0.00009, lx:  99684, dx:     9, Lx:  99680, Tx:   7348693, ex: 73.7 },
  { age:  11, qx: 0.00010, lx:  99675, dx:    10, Lx:  99670, Tx:   7249014, ex: 72.7 },
  { age:  12, qx: 0.00011, lx:  99665, dx:    11, Lx:  99660, Tx:   7149344, ex: 71.7 },
  { age:  13, qx: 0.00013, lx:  99654, dx:    13, Lx:  99648, Tx:   7049684, ex: 70.7 },
  { age:  14, qx: 0.00015, lx:  99641, dx:    15, Lx:  99634, Tx:   6950037, ex: 69.8 },
  { age:  15, qx: 0.00018, lx:  99626, dx:    18, Lx:  99617, Tx:   6850403, ex: 68.8 },
  { age:  16, qx: 0.00020, lx:  99608, dx:    20, Lx:  99598, Tx:   6750786, ex: 67.8 },
  { age:  17, qx: 0.00022, lx:  99588, dx:    22, Lx:  99577, Tx:   6651188, ex: 66.8 },
  { age:  18, qx: 0.00024, lx:  99566, dx:    23, Lx:  99555, Tx:   6551611, ex: 65.8 },
  { age:  19, qx: 0.00025, lx:  99543, dx:    24, Lx:  99531, Tx:   6452057, ex: 64.8 },
  { age:  20, qx: 0.00025, lx:  99519, dx:    25, Lx:  99507, Tx:   6352526, ex: 63.8 },
  { age:  21, qx: 0.00026, lx:  99494, dx:    26, Lx:  99481, Tx:   6253019, ex: 62.8 },
  { age:  22, qx: 0.00027, lx:  99468, dx:    27, Lx:  99455, Tx:   6153538, ex: 61.9 },
  { age:  23, qx: 0.00028, lx:  99441, dx:    28, Lx:  99427, Tx:   6054084, ex: 60.9 },
  { age:  24, qx: 0.00028, lx:  99413, dx:    28, Lx:  99399, Tx:   5954657, ex: 59.9 },
  { age:  25, qx: 0.00029, lx:  99385, dx:    29, Lx:  99371, Tx:   5855258, ex: 58.9 },
  { age:  26, qx: 0.00029, lx:  99356, dx:    29, Lx:  99342, Tx:   5755887, ex: 57.9 },
  { age:  27, qx: 0.00030, lx:  99327, dx:    30, Lx:  99312, Tx:   5656546, ex: 56.9 },
  { age:  28, qx: 0.00031, lx:  99297, dx:    31, Lx:  99282, Tx:   5557234, ex: 56.0 },
  { age:  29, qx: 0.00032, lx:  99266, dx:    32, Lx:  99250, Tx:   5457952, ex: 55.0 },
  { age:  30, qx: 0.00033, lx:  99234, dx:    33, Lx:  99218, Tx:   5358702, ex: 54.0 },
  { age:  31, qx: 0.00034, lx:  99201, dx:    34, Lx:  99184, Tx:   5259485, ex: 53.0 },
  { age:  32, qx: 0.00036, lx:  99167, dx:    36, Lx:  99149, Tx:   5160301, ex: 52.0 },
  { age:  33, qx: 0.00038, lx:  99131, dx:    38, Lx:  99112, Tx:   5061152, ex: 51.1 },
  { age:  34, qx: 0.00041, lx:  99093, dx:    41, Lx:  99073, Tx:   4962040, ex: 50.1 },
  { age:  35, qx: 0.00044, lx:  99052, dx:    43, Lx:  99031, Tx:   4862967, ex: 49.1 },
  { age:  36, qx: 0.00047, lx:  99009, dx:    46, Lx:  98986, Tx:   4763937, ex: 48.1 },
  { age:  37, qx: 0.00050, lx:  98963, dx:    50, Lx:  98938, Tx:   4664951, ex: 47.1 },
  { age:  38, qx: 0.00055, lx:  98913, dx:    54, Lx:  98886, Tx:   4566013, ex: 46.2 },
  { age:  39, qx: 0.00060, lx:  98859, dx:    60, Lx:  98829, Tx:   4467127, ex: 45.2 },
  { age:  40, qx: 0.00066, lx:  98799, dx:    65, Lx:  98767, Tx:   4368298, ex: 44.2 },
  { age:  41, qx: 0.00072, lx:  98734, dx:    71, Lx:  98699, Tx:   4269531, ex: 43.2 },
  { age:  42, qx: 0.00079, lx:  98663, dx:    78, Lx:  98624, Tx:   4170833, ex: 42.3 },
  { age:  43, qx: 0.00088, lx:  98585, dx:    87, Lx:  98542, Tx:   4072209, ex: 41.3 },
  { age:  44, qx: 0.00098, lx:  98498, dx:    96, Lx:  98450, Tx:   3973667, ex: 40.3 },
  { age:  45, qx: 0.00108, lx:  98402, dx:   106, Lx:  98349, Tx:   3875217, ex: 39.4 },
  { age:  46, qx: 0.00119, lx:  98296, dx:   117, Lx:  98238, Tx:   3776868, ex: 38.4 },
  { age:  47, qx: 0.00131, lx:  98179, dx:   129, Lx:  98115, Tx:   3678631, ex: 37.5 },
  { age:  48, qx: 0.00146, lx:  98050, dx:   143, Lx:  97979, Tx:   3580516, ex: 36.5 },
  { age:  49, qx: 0.00163, lx:  97907, dx:   159, Lx:  97828, Tx:   3482538, ex: 35.6 },
  { age:  50, qx: 0.00180, lx:  97748, dx:   176, Lx:  97660, Tx:   3384710, ex: 34.6 },
  { age:  51, qx: 0.00198, lx:  97572, dx:   193, Lx:  97476, Tx:   3287050, ex: 33.7 },
  { age:  52, qx: 0.00219, lx:  97379, dx:   213, Lx:  97273, Tx:   3189575, ex: 32.8 },
  { age:  53, qx: 0.00243, lx:  97166, dx:   237, Lx:  97048, Tx:   3092302, ex: 31.8 },
  { age:  54, qx: 0.00271, lx:  96929, dx:   263, Lx:  96798, Tx:   2995255, ex: 30.9 },
  { age:  55, qx: 0.00299, lx:  96666, dx:   289, Lx:  96522, Tx:   2898457, ex: 30.0 },
  { age:  56, qx: 0.00329, lx:  96377, dx:   317, Lx:  96219, Tx:   2801936, ex: 29.1 },
  { age:  57, qx: 0.00362, lx:  96060, dx:   348, Lx:  95886, Tx:   2705717, ex: 28.2 },
  { age:  58, qx: 0.00402, lx:  95712, dx:   385, Lx:  95520, Tx:   2609831, ex: 27.3 },
  { age:  59, qx: 0.00445, lx:  95327, dx:   424, Lx:  95115, Tx:   2514312, ex: 26.4 },
  { age:  60, qx: 0.00489, lx:  94903, dx:   464, Lx:  94671, Tx:   2419197, ex: 25.5 },
  { age:  61, qx: 0.00535, lx:  94439, dx:   505, Lx:  94187, Tx:   2324526, ex: 24.6 },
  { age:  62, qx: 0.00589, lx:  93934, dx:   554, Lx:  93657, Tx:   2230339, ex: 23.7 },
  { age:  63, qx: 0.00656, lx:  93380, dx:   613, Lx:  93074, Tx:   2136682, ex: 22.9 },
  { age:  64, qx: 0.00730, lx:  92767, dx:   677, Lx:  92429, Tx:   2043609, ex: 22.0 },
  { age:  65, qx: 0.00807, lx:  92090, dx:   743, Lx:  91719, Tx:   1951180, ex: 21.2 },
  { age:  66, qx: 0.00886, lx:  91347, dx:   809, Lx:  90943, Tx:   1859462, ex: 20.4 },
  { age:  67, qx: 0.00973, lx:  90538, dx:   881, Lx:  90098, Tx:   1768519, ex: 19.5 },
  { age:  68, qx: 0.01071, lx:  89657, dx:   960, Lx:  89177, Tx:   1678422, ex: 18.7 },
  { age:  69, qx: 0.01175, lx:  88697, dx:  1042, Lx:  88176, Tx:   1589245, ex: 17.9 },
  { age:  70, qx: 0.01280, lx:  87655, dx:  1122, Lx:  87094, Tx:   1501069, ex: 17.1 },
  { age:  71, qx: 0.01394, lx:  86533, dx:  1206, Lx:  85930, Tx:   1413975, ex: 16.3 },
  { age:  72, qx: 0.01535, lx:  85327, dx:  1310, Lx:  84672, Tx:   1328045, ex: 15.6 },
  { age:  73, qx: 0.01714, lx:  84017, dx:  1440, Lx:  83297, Tx:   1243373, ex: 14.8 },
  { age:  74, qx: 0.01912, lx:  82577, dx:  1579, Lx:  81788, Tx:   1160076, ex: 14.0 },
  { age:  75, qx: 0.02113, lx:  80998, dx:  1712, Lx:  80142, Tx:   1078288, ex: 13.3 },
  { age:  76, qx: 0.02334, lx:  79286, dx:  1851, Lx:  78361, Tx:    998146, ex: 12.6 },
  { age:  77, qx: 0.02624, lx:  77435, dx:  2032, Lx:  76419, Tx:    919786, ex: 11.9 },
  { age:  78, qx: 0.03018, lx:  75403, dx:  2276, Lx:  74265, Tx:    843367, ex: 11.2 },
  { age:  79, qx: 0.03473, lx:  73127, dx:  2539, Lx:  71858, Tx:    769102, ex: 10.5 },
  { age:  80, qx: 0.03939, lx:  70588, dx:  2780, Lx:  69198, Tx:    697244, ex: 9.9 },
  { age:  81, qx: 0.04417, lx:  67808, dx:  2995, Lx:  66311, Tx:    628046, ex: 9.3 },
  { age:  82, qx: 0.04960, lx:  64813, dx:  3215, Lx:  63206, Tx:    561736, ex: 8.7 },
  { age:  83, qx: 0.05629, lx:  61598, dx:  3467, Lx:  59865, Tx:    498530, ex: 8.1 },
  { age:  84, qx: 0.06422, lx:  58131, dx:  3733, Lx:  56265, Tx:    438666, ex: 7.5 },
  { age:  85, qx: 0.07263, lx:  54398, dx:  3951, Lx:  52423, Tx:    382401, ex: 7.0 },
  { age:  86, qx: 0.08191, lx:  50447, dx:  4132, Lx:  48381, Tx:    329979, ex: 6.5 },
  { age:  87, qx: 0.09211, lx:  46315, dx:  4266, Lx:  44182, Tx:    281598, ex: 6.1 },
  { age:  88, qx: 0.10329, lx:  42049, dx:  4343, Lx:  39878, Tx:    237416, ex: 5.6 },
  { age:  89, qx: 0.11548, lx:  37706, dx:  4354, Lx:  35529, Tx:    197538, ex: 5.2 },
  { age:  90, qx: 0.12874, lx:  33352, dx:  4294, Lx:  31205, Tx:    162009, ex: 4.9 },
  { age:  91, qx: 0.14308, lx:  29058, dx:  4158, Lx:  26979, Tx:    130804, ex: 4.5 },
  { age:  92, qx: 0.15854, lx:  24900, dx:  3948, Lx:  22926, Tx:    103825, ex: 4.2 },
  { age:  93, qx: 0.17514, lx:  20952, dx:  3669, Lx:  19118, Tx:     80899, ex: 3.9 },
  { age:  94, qx: 0.19288, lx:  17283, dx:  3334, Lx:  15616, Tx:     61782, ex: 3.6 },
  { age:  95, qx: 0.21176, lx:  13949, dx:  2954, Lx:  12472, Tx:     46166, ex: 3.3 },
  { age:  96, qx: 0.23178, lx:  10995, dx:  2548, Lx:   9721, Tx:     33694, ex: 3.1 },
  { age:  97, qx: 0.25289, lx:   8447, dx:  2136, Lx:   7379, Tx:     23973, ex: 2.8 },
  { age:  98, qx: 0.27507, lx:   6311, dx:  1736, Lx:   5443, Tx:     16594, ex: 2.6 },
  { age:  99, qx: 0.29826, lx:   4575, dx:  1365, Lx:   3893, Tx:     11151, ex: 2.4 },
  { age: 100, qx: 1.00000, lx:   3210, dx:  3210, Lx:   7258, Tx:      7258, ex: 2.3 },
];

/**
 * Look up the probability of dying (qx) for a given age and sex.
 * For age >= 100, returns qx = 1.0 (the open-interval terminal row).
 *
 * @param age   - integer age in completed years
 * @param sex   - "male" | "female" | "total"
 * @returns qx  - annual probability of death (0 to 1)
 */
export function getQx(age: number, sex: "male" | "female" | "total"): number {
  const table =
    sex === "male"
      ? maleLifeTable2024
      : sex === "female"
        ? femaleLifeTable2024
        : totalLifeTable2024;
  const clampedAge = Math.min(Math.floor(age), 100);
  const row = table[clampedAge]; // index === age since table is 0-indexed by age
  return row?.qx ?? 1.0;
}

/**
 * Look up the remaining life expectancy (ex) for a given age and sex.
 * For age >= 100, returns ex from the terminal row.
 *
 * @param age   - integer age in completed years
 * @param sex   - "male" | "female" | "total"
 * @returns ex  - expected additional years of life
 */
export function getEx(age: number, sex: "male" | "female" | "total"): number {
  const table =
    sex === "male"
      ? maleLifeTable2024
      : sex === "female"
        ? femaleLifeTable2024
        : totalLifeTable2024;
  const clampedAge = Math.min(Math.floor(age), 100);
  const row = table[clampedAge];
  return row?.ex ?? 0;
}

/**
 * Probability of surviving from age `fromAge` to age `toAge`.
 * Uses annual qx values chained together: prod(1 - qx[a]) for a in [fromAge, toAge).
 *
 * @param fromAge  - starting age (integer)
 * @param toAge    - target age (integer, exclusive upper bound)
 * @param sex      - "male" | "female" | "total"
 * @returns        - probability of survival (0 to 1)
 */
export function survivalProbability(
  fromAge: number,
  toAge: number,
  sex: "male" | "female" | "total"
): number {
  let p = 1.0;
  for (let a = Math.floor(fromAge); a < Math.min(Math.floor(toAge), 100); a++) {
    p *= 1 - getQx(a, sex);
  }
  return p;
}
