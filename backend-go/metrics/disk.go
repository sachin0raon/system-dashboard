package metrics

import (
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

// hostRoot is /hostfs when that directory exists (i.e. the container has the
// host root bind-mounted there).  When running natively it stays empty.
// This matters because /proc:/proc:ro gives gopsutil the host partition list,
// but syscall.Statfs on those mountpoints still hits the overlay2 root inside
// the container.  Docker's overlay2 returns f_files=0 on many kernels, so
// inode counts are always zero without this workaround.
var hostRoot = func() string {
	if _, err := os.Stat("/hostfs"); err == nil {
		return "/hostfs"
	}
	return ""
}()

// resolvePath returns the path to use for syscall.Statfs.
// When hostRoot is set, prepend it so we stat the real host filesystem
// instead of the container's overlay mount.
func resolvePath(mountpoint string) string {
	if hostRoot == "" {
		return mountpoint
	}
	if mountpoint == "/" {
		return hostRoot
	}
	return filepath.Join(hostRoot, mountpoint)
}

func collectDisk(s *diskState) DiskInfo {
	parts, err := disk.Partitions(false)
	if err != nil {
		parts = nil
	}

	partitions := make([]DiskPartition, 0, len(parts))
	for _, p := range parts {
		statPath := resolvePath(p.Mountpoint)

		usage, err := disk.Usage(statPath)
		if err != nil {
			continue
		}

		inodesTotal, inodesUsed, inodesFree, inodesPercent := inodeStats(statPath)

		partitions = append(partitions, DiskPartition{
			Device:        p.Device,
			Mountpoint:    p.Mountpoint, // display the real mount path, not /hostfs/…
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
func inodeStats(path string) (total, used, free uint64, percent float64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
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
