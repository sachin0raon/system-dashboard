package metrics

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

func collectDisk(s *diskState) DiskInfo {
	parts, err := disk.Partitions(false)
	if err != nil {
		parts = nil
	}

	// Parse /proc/mounts once per tick to determine read-only status for all partitions.
	roMap := mountROMap()

	partitions := make([]DiskPartition, 0, len(parts))
	for _, p := range parts {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}

		// Device type is permanent; detect once and cache in diskState.
		devType, ok := s.deviceTypes[p.Device]
		if !ok {
			devType = detectDeviceType(p.Device)
			s.deviceTypes[p.Device] = devType
		}

		partitions = append(partitions, DiskPartition{
			Device:     p.Device,
			Mountpoint: p.Mountpoint,
			Fstype:     p.Fstype,
			TotalBytes: usage.Total,
			UsedBytes:  usage.Used,
			FreeBytes:  usage.Free,
			Percent:    usage.UsedPercent,
			ReadOnly:   roMap[p.Mountpoint],
			DeviceType: devType,
		})
	}

	// Aggregate I/O across all block devices.
	readBPS, writeBPS, readOPS, writeOPS := 0.0, 0.0, 0.0, 0.0
	counters, err := disk.IOCounters()
	if err == nil {
		var cur diskIOSnapshot
		for _, c := range counters {
			cur.readBytes += c.ReadBytes
			cur.writeBytes += c.WriteBytes
			cur.readCount += c.ReadCount
			cur.writeCount += c.WriteCount
		}

		now := time.Now()
		if !s.prevTime.IsZero() {
			dt := now.Sub(s.prevTime).Seconds()
			if dt > 0 {
				readBPS = float64(cur.readBytes-s.prev.readBytes) / dt
				writeBPS = float64(cur.writeBytes-s.prev.writeBytes) / dt
				readOPS = float64(cur.readCount-s.prev.readCount) / dt
				writeOPS = float64(cur.writeCount-s.prev.writeCount) / dt
			}
		}
		s.prev = cur
		s.prevTime = now
	}

	if readBPS < 0 {
		readBPS = 0
	}
	if writeBPS < 0 {
		writeBPS = 0
	}

	return DiskInfo{
		Partitions:       partitions,
		ReadBytesPerSec:  readBPS,
		WriteBytesPerSec: writeBPS,
		ReadCountPerSec:  readOPS,
		WriteCountPerSec: writeOPS,
	}
}

// mountROMap parses /proc/mounts and returns a map of mountpoint → read-only.
// /proc is bind-mounted from the host so this reflects the actual host state.
func mountROMap() map[string]bool {
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return nil
	}
	m := make(map[string]bool)
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		ro := false
		for _, opt := range strings.Split(fields[3], ",") {
			if opt == "ro" {
				ro = true
				break
			}
		}
		m[fields[1]] = ro
	}
	return m
}

// detectDeviceType classifies a block device by name and sysfs attributes.
// Returns one of: "NVMe", "SD Card", "SSD", "HDD", "USB", or "" for unknown.
func detectDeviceType(device string) string {
	blk := blockDevName(device)
	switch {
	case strings.HasPrefix(blk, "nvme"):
		return "NVMe"
	case strings.HasPrefix(blk, "mmcblk"):
		return "SD Card"
	case strings.HasPrefix(blk, "sd"), strings.HasPrefix(blk, "hd"):
		removable := readSysBlockInt(blk, "removable")
		if removable == 1 {
			return "USB"
		}
		if readSysBlockInt(blk, "queue/rotational") == 0 {
			return "SSD"
		}
		return "HDD"
	}
	return ""
}

// blockDevName strips the partition suffix from a device path.
// /dev/nvme0n1p2 → nvme0n1, /dev/mmcblk0p2 → mmcblk0, /dev/sda1 → sda
func blockDevName(device string) string {
	name := filepath.Base(device)
	switch {
	case strings.HasPrefix(name, "nvme"):
		// nvme0n1p2: partition component starts at the last 'p'
		if i := strings.LastIndexByte(name, 'p'); i > 4 {
			return name[:i]
		}
	case strings.HasPrefix(name, "mmcblk"):
		// mmcblk0p2: partition component starts at the last 'p'
		if i := strings.LastIndexByte(name, 'p'); i > 5 {
			return name[:i]
		}
	default:
		// sda1, hdb2: strip trailing digits
		i := len(name)
		for i > 0 && name[i-1] >= '0' && name[i-1] <= '9' {
			i--
		}
		return name[:i]
	}
	return name
}

func readSysBlockInt(blk, file string) int {
	data, err := os.ReadFile(fmt.Sprintf("/sys/block/%s/%s", blk, file))
	if err != nil {
		return -1
	}
	n, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return -1
	}
	return n
}
