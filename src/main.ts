import { ChargeHandler } from "./Bases/ChargeHandler"
import { RangeHandlerStatic } from "./Bases/RangeHandler"

import { Sensor } from "./Classes/Sensor"
import { Target } from "./Classes/Target"

import { LBP } from "./Classes/LBP"
import { DEEPS } from "./Classes/DEEPS"

import { Fixed } from "./Classes/Fixed"
import { Adjustable } from "./Classes/Adjustable"

const debug = false

export function log(...params: any[]) {
	if (debug) {
		console.log.apply(console, arguments)
	}
}

const width = 8,
	maxDistance = 2,
	sensorCount = 50,
	targetCount = 10,
	maxRange = Math.pow(maxDistance, 2)

const used = {} as { [x: number]: { [y: number]: boolean | undefined } | undefined }

function pos() {
	function rand() {
		return Math.floor(Math.random() * (width + 1))
	}

	let x = rand(),
		y = rand()

	while (used[x] != undefined && used[x]![y]) {
		x = rand()
		y = rand()
	}

	if (used[x] == undefined) {
		used[x] = {}
	}

	used[x]![y] = true

	return {
		x,
		y
	}
}

function battery() {
	return Math.random() * maxRange + 5 * maxRange
}

const sensorVars = [] as { x: number, y: number, b: number }[],
	targetVars = [] as { x: number, y: number }[]

for (let i = 0; i < sensorCount; i++) {
	const p = pos()

	sensorVars.push({
		x: p.x,
		y: p.y,
		b: battery()
	})
}

for (let i = 0; i < targetCount; i++) {
	const p = pos()

	targetVars.push({
		x: p.x,
		y: p.y
	})
}

// const sensorVars = [{
// 		x: 0,
// 		y: 0,
// 		b: 8 * maxRange
// 	}, {
// 		x: 2,
// 		y: 0,
// 		b: 8 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 0,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}, {
// 		x: 2,
// 		y: 2,
// 		b: 1 * maxRange
// 	}],
// 	targetVars = [{
// 		x: 1,
// 		y: 0
// 	}, {
// 		x: 0,
// 		y: 1
// 	}, {
// 		x: 2,
// 		y: 1
// 	}]

sensorVars.sort((lhs, rhs) => lhs.x - rhs.x)
targetVars.sort((lhs, rhs) => lhs.x - rhs.x)

type Protocol = {
	name: string,
	range: RangeHandlerStatic,
	charge: ChargeHandler
}

const protocols = [{
	name: "Fixed Range LPB",
	range: Fixed,
	charge: LBP
}, {
	name: "Fixed Range DEEPS",
	range: Fixed,
	charge: DEEPS
}, {
	name: "Adjustable Range LPB",
	range: Adjustable,
	charge: LBP
}, {
	name: "Adjustable Range DEEPS",
	range: Adjustable,
	charge: DEEPS
}] as Protocol[]

run(protocols)

function run(protocols: Protocol[]) {
	const protocol = protocols.shift()!

	if (!protocol) {
		return
	}

	let sensors = sensorVars.map((v) => new Sensor(protocol.charge, protocol.range, maxRange, v.x, v.y, v.b)),
		targets = targetVars.map((v) => new Target(v.x, v.y))

	let upper = 0,
		lower = 0

	for (const sensor of sensors) {
		// Fix the lower bound of targets to consider
		while (targets[lower] && sensor.x - targets[lower].x > maxDistance) {
			lower++
		}

		// Fix the upper bound of targets to consider
		while (targets[upper] && sensor.x - targets[upper].x >= -maxDistance) {
			upper++
		}

		sensor.targets = targets.slice(lower, upper).filter((target) => target.distanceTo(sensor) <= maxDistance)

		for (const target of sensor.targets) {
			target.sensors.push(sensor)
		}

		sensor.targets.sort((lhs, rhs) => sensor.distanceTo(lhs) - sensor.distanceTo(rhs))
	}

	upper = 0
	lower = 0

	for (const sensor of sensors) {
		// Fix the lower bound of targets to consider
		while (sensors[lower] && sensor.x - sensors[lower].x > maxDistance * 2) {
			lower++
		}

		// Fix the upper bound of targets to consider
		while (sensors[upper] && sensor.x - sensors[upper].x >= -maxDistance * 2) {
			upper++
		}

		sensor.sensors = sensors.slice(lower, upper).filter((otherSensor) => otherSensor !== sensor && otherSensor.distanceTo(sensor) <= maxDistance * 2)
		sensor.sensors.sort((lhs, rhs) => sensor.distanceTo(lhs) - sensor.distanceTo(rhs))
	}

	for (const target of targets) {
		target.sensors.sort((lhs, rhs) => target.distanceTo(lhs) - target.distanceTo(rhs))
	}

	let life = 0

	iterate()

	function iterate() {
		sensors.forEach((sensor) => sensor.prepare())
		sensors.forEach((sensor) => sensor.shuffle())

		runShift()

		function runShift() {
			let hadAny = false

			sensors.forEach((sensor) => {
				const step = sensor.shuffleSteps.shift()

				if (step) {
					hadAny = true

					step()
				}
			})

			if (hadAny) {
				process.nextTick(runShift)
			} else {
				let weak: Sensor = undefined as any

				sensors = sensors.filter((sensor) => {
					// Padding for JS roundoff error
					if (sensor.battery === 0) {
						sensor.kill()

						return false
					}

					if (!weak || weak.battery / weak.range > sensor.battery / sensor.range) {
						weak = sensor
					}

					return true
				})

				const dead = targets.some((target) => {
					const noCoverage = target.sensors.length === 0,
					allOff = !target.sensors.some((sensor) => {
						return sensor.range > 0
					})

					if (noCoverage) {
						log("No coverage!!")
					} else if (allOff) {
						log(`All of ${target.id} off!! One of [${target.sensors.sort((l, r) => l.id - r.id)}] should have stayed on...`)
					}

					return noCoverage || allOff
				})

				// If any target is uncovered after killing dead sensors, break out here
				if (dead) {
					console.log(`${protocol.name}: ${life}`)

					return run(protocols)
				}

				log("Iteration:")

				const iteration = Math.min(1, weak.battery / weak.range)

				for (const sensor of sensors) {
					if (sensor.range > 0) {
						log(`${sensor.id}: ${sensor.battery / sensor.range}`)
					}

					sensor.battery -= sensor.range * iteration

					if (sensor.battery <= 10e-3) {
						sensor.battery = 0
					}
				}

				life += iteration

				iterate()
			}
		}
	}
}
