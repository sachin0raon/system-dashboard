package metrics

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/host"
)

// throttleCache prevents forking vcgencmd on every 2-second tick.
// vcgencmd output changes rarely; a 10-second TTL is sufficient.
var throttleCache struct {
	sync.Mutex
	flags   throttleFlags
	expires time.Time
}

type throttleFlags struct {
	underVoltage  bool
	throttled     bool
	freqCapped    bool
	softTempLimit bool
}

func collectTemperature() TempInfo {
	sensors := make(map[string]float64)
	var cpuTemp, gpuTemp *float64

	// Prefer gopsutil sensor readings (reads /sys/class/hwmon/*)
	temps, err := host.SensorsTemperatures()
	if err == nil {
		for _, t := range temps {
			sensors[t.SensorKey] = t.Temperature
			key := strings.ToLower(t.SensorKey)
			if cpuTemp == nil && (strings.Contains(key, "cpu") || strings.Contains(key, "coretemp")) {
				v := t.Temperature
				cpuTemp = &v
			}
		}
	}

	// Pi fallback: /sys/class/thermal/thermal_zone0/temp
	if cpuTemp == nil {
		if v := readThermalZone(0); v != nil {
			cpuTemp = v
			sensors["cpu_thermal/cpu_thermal"] = *v
		}
	}

	// On Pi the CPU and GPU share the same SoC die — GPU temp == CPU temp.
	if gpuTemp == nil {
		gpuTemp = cpuTemp
	}

	flags := cachedThrottleFlags()

	return TempInfo{
		CPUCelsius:     cpuTemp,
		GPUCelsius:     gpuTemp,
		FanSpeedRPM:    readFanSpeed(),
		Sensors:        sensors,
		IsUnderVoltage: flags.underVoltage,
		IsThrottled:    flags.throttled,
		FreqCapped:     flags.freqCapped,
		SoftTempLimit:  flags.softTempLimit,
	}
}

func readThermalZone(zone int) *float64 {
	data, err := readFileStr(fmt.Sprintf("/sys/class/thermal/thermal_zone%d/temp", zone))
	if err != nil {
		return nil
	}
	raw, err := strconv.ParseInt(strings.TrimSpace(data), 10, 64)
	if err != nil {
		return nil
	}
	v := float64(raw) / 1000.0
	return &v
}

func readFanSpeed() *float64 {
	entries, err := readGlobFirst("/sys/class/hwmon/*/fan1_input")
	if err != nil {
		return nil
	}
	raw, err := strconv.ParseFloat(strings.TrimSpace(entries), 64)
	if err != nil {
		return nil
	}
	return &raw
}

// cachedThrottleFlags returns vcgencmd throttle state with a 10s TTL.
// Only spawns a subprocess at most once per TTL window.
func cachedThrottleFlags() throttleFlags {
	throttleCache.Lock()
	defer throttleCache.Unlock()
	if time.Now().Before(throttleCache.expires) {
		return throttleCache.flags
	}
	throttleCache.flags = parseVcgencmdThrottle()
	throttleCache.expires = time.Now().Add(10 * time.Second)
	return throttleCache.flags
}

func parseVcgencmdThrottle() throttleFlags {
	out, err := exec.Command("vcgencmd", "get_throttled").Output()
	if err != nil {
		return throttleFlags{}
	}
	// output: "throttled=0x50000"
	parts := strings.SplitN(strings.TrimSpace(string(out)), "=", 2)
	if len(parts) != 2 {
		return throttleFlags{}
	}
	val, err := strconv.ParseUint(strings.TrimPrefix(parts[1], "0x"), 16, 32)
	if err != nil {
		return throttleFlags{}
	}
	return throttleFlags{
		underVoltage:  val&1 != 0,
		freqCapped:    val&2 != 0,
		throttled:     val&4 != 0,
		softTempLimit: val&8 != 0,
	}
}
