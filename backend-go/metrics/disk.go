package metrics

import (
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

func collectDisk(s *diskState) DiskInfo {
	parts, err := disk.Partitions(false)
	if err != nil {
		parts = nil
	}

	partitions := make([]DiskPartition, 0, len(parts))
	for _, p := range parts {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}

		inodesTotal, inodesUsed, inodesFree, inodesPercent := inodeStats(p.Mountpoint)

		partitions = append(partitions, DiskPartition{
			Device:        p.Device,
			Mountpoint:    p.Mountpoint,
			Fstype:        p.Fstype,
			TotalBytes:    usage.Total,
			UsedBytes:     usage.Used,
			FreeBytes:     usage.Free,
			Percent:       usage.UsedPercent,
			InodesPercent: inodesPercent,
			InodesTotal:   inodesTotal,
			InodesUsed:    inodesUsed,
			InodesFree:    inodesFree,
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

// inodeStats uses syscall.Statfs (equivalent to Python's os.statvfs).
func inodeStats(mountpoint string) (total, used, free uint64, percent float64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(mountpoint, &stat); err != nil {
		return
	}
	total = stat.Files
	free = stat.Ffree
	if total >= free {
		used = total - free
	}
	if total > 0 {
		percent = float64(used) / float64(total) * 100
	}
	return
}
