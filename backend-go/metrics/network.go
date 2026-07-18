package metrics

import (
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	gnet "github.com/shirou/gopsutil/v3/net"
)

func collectNetwork(s *netState) NetworkInfo {
	counters, err := gnet.IOCounters(true) // pernic=true
	if err != nil {
		return NetworkInfo{Interfaces: []NetworkInterface{}}
	}

	now := time.Now()
	dt := 0.0
	if !s.prevTime.IsZero() {
		dt = now.Sub(s.prevTime).Seconds()
	}

	// Refresh IP cache every 60s (DHCP can change addresses, but rarely).
	if now.After(s.ipExpiry) {
		s.ipCache = make(map[string]*string, len(counters))
		s.ipExpiry = now.Add(60 * time.Second)
	}

	ifaces := make([]NetworkInterface, 0, len(counters))

	// Clear and reuse s.prev in-place to avoid a map allocation every tick.
	// Go's map implementation reuses underlying bucket memory after delete.
	for k := range s.prev {
		delete(s.prev, k)
	}

	for _, c := range counters {
		prev := s.prev[c.Name]

		sentBPS, recvBPS, sentPPS, recvPPS := 0.0, 0.0, 0.0, 0.0
		if dt > 0 {
			sentBPS = max0(float64(c.BytesSent-prev.bytesSent) / dt)
			recvBPS = max0(float64(c.BytesRecv-prev.bytesRecv) / dt)
			sentPPS = max0(float64(c.PacketsSent-prev.packetsSent) / dt)
			recvPPS = max0(float64(c.PacketsRecv-prev.packetsRecv) / dt)
		}

		s.prev[c.Name] = netIOSnapshot{
			bytesSent:   c.BytesSent,
			bytesRecv:   c.BytesRecv,
			packetsSent: c.PacketsSent,
			packetsRecv: c.PacketsRecv,
		}

		// IP: use cache; populated at ipExpiry refresh above.
		ip, ok := s.ipCache[c.Name]
		if !ok {
			ip = getIPv4(c.Name)
			s.ipCache[c.Name] = ip
		}

		// Speed: read once and never re-read; link speed doesn't change at runtime.
		speed, ok := s.speedCache[c.Name]
		if !ok {
			speed = ifaceSpeed(c.Name)
			s.speedCache[c.Name] = speed
		}

		ifaces = append(ifaces, NetworkInterface{
			Name:              c.Name,
			BytesSentPerSec:   sentBPS,
			BytesRecvPerSec:   recvBPS,
			BytesSentTotal:    c.BytesSent,
			BytesRecvTotal:    c.BytesRecv,
			PacketsSentPerSec: sentPPS,
			PacketsRecvPerSec: recvPPS,
			ErrorsTotal:       c.Errin + c.Errout,
			DropsTotal:        c.Dropin + c.Dropout,
			SpeedMbps:         speed,
			IPAddress:         ip,
		})
	}

	s.prevTime = now

	return NetworkInfo{Interfaces: ifaces}
}

// getIPv4 uses the stdlib net package — cleaner than gopsutil's Interfaces().
func getIPv4(name string) *string {
	iface, err := net.InterfaceByName(name)
	if err != nil {
		return nil
	}
	addrs, err := iface.Addrs()
	if err != nil {
		return nil
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok {
			if ip4 := ipnet.IP.To4(); ip4 != nil {
				s := ip4.String()
				return &s
			}
		}
	}
	return nil
}

// ifaceSpeed reads link speed from sysfs; returns 0 for virtual interfaces.
func ifaceSpeed(name string) int {
	data, err := readFileStr(fmt.Sprintf("/sys/class/net/%s/speed", name))
	if err != nil {
		return 0
	}
	speed, err := strconv.Atoi(strings.TrimSpace(data))
	if err != nil || speed < 0 {
		return 0
	}
	return speed
}

func max0(v float64) float64 {
	if v < 0 {
		return 0
	}
	return v
}
