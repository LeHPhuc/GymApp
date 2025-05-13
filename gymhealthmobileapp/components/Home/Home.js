import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSelector } from "react-redux";
import axiosInstance, { endpoints } from "../../configs/API";
import { LineChart } from "react-native-chart-kit";

const mockNotifications = [
  {
    id: "1",
    message: "Lịch tập với PT vào lúc 18:00 hôm nay",
    time: "2 giờ trước",
    read: false,
  },
  {
    id: "2",
    message: "Gói tập của bạn sẽ hết hạn trong 7 ngày",
    time: "1 ngày trước",
    read: true,
  },
  {
    id: "3",
    message: "Khuyến mãi đặc biệt: Giảm 20% gói tập 1 năm",
    time: "3 ngày trước",
    read: true,
  },
];

const Home = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState("home");
  const [userPackage, setUserPackage] = useState(null);
  const [notifications, setNotifications] = useState(mockNotifications);
  const [upcomingSchedule, setUpcomingSchedule] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainingProgress, setTrainingProgress] = useState([]);
  const [latestProgressRecord, setLatestProgressRecord] = useState(null);
  const [error, setError] = useState(null);

  // Lấy thông tin người dùng từ Redux store
  const userFromRedux = useSelector((state) => state.user);

  // Lấy thông tin gói tập từ API// Lấy thông tin gói tập từ API
  const fetchSubscription = async () => {
    try {
      setLoading(true);

      // Lấy access token từ AsyncStorage
      const accessToken = await AsyncStorage.getItem("accessToken");
      console.log("Access Token for subscription:", accessToken);

      if (!accessToken) {
        console.log("No access token found");
        throw new Error("Không tìm thấy token đăng nhập");
      }

      console.log("Requesting URL:", endpoints.subscription + "my/");
      const response = await axiosInstance.get(endpoints.subscription + "my/", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Sử dụng axios trực tiếp với URL đầy đủ

      console.log("Response data:", response.data);
      console.log("Subscription API response:", response.status);

      // Lọc ra gói đang hoạt động (active) và lấy gói mới nhất
      const activeSubscriptions = response.data.results.filter(
        (sub) => sub.status === "active"
      );

      if (activeSubscriptions.length > 0) {
        // Sắp xếp theo ngày bắt đầu để lấy gói mới nhất
        const latestSubscription = activeSubscriptions.sort(
          (a, b) => new Date(b.start_date) - new Date(a.start_date)
        )[0];

        // Chuyển đổi dữ liệu để phù hợp với định dạng cũ
        const formattedPackage = {
          id: latestSubscription.id.toString(),
          name: latestSubscription.package_name,
          price: `${parseFloat(
            latestSubscription.discounted_price
          ).toLocaleString("vi-VN")}đ`,
          benefits: latestSubscription.package.benefits
            .map((b) => b.name)
            .join(", "),
          sessions: latestSubscription.remaining_pt_sessions,
          duration: `${latestSubscription.package.package_type.duration_months} tháng`,
          endDate: latestSubscription.end_date,
          startDate: latestSubscription.start_date,
          remainingDays: latestSubscription.remaining_days,
          // Lưu trữ dữ liệu gốc để sử dụng nếu cần
          originalData: latestSubscription,
        };

        setUserPackage(formattedPackage);
      } else {
        // Không có gói đang hoạt động
        setUserPackage(null);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      setError("Không thể tải dữ liệu gói tập");
      setLoading(false);
    }
  };

  // Hàm chuyển đổi status sang tiếng Việt
  const translateStatus = (status) => {
    const statusMap = {
      pending: "Chờ duyệt",
      confirmed: "Đã xác nhận",
      completed: "Đã hoàn thành",
      cancelled: "Đã hủy",
      rescheduled: "Đã đổi lịch",
    };

    return statusMap[status] || status;
  };

  // Hàm định dạng ngày tháng
  const formatDate = (dateString) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", options);
  };

  // Hàm định dạng thời gian
  const formatTime = (timeString) => {
    // timeString có dạng "HH:MM:SS"
    if (!timeString) return "";

    // Lấy 5 ký tự đầu tiên (HH:MM)
    const formattedTime = timeString.substring(0, 5);
    return formattedTime;
  };

  // Lấy thông tin lịch tập từ API
  const fetchUpcomingSchedules = async () => {
    try {
      setLoading(true);

      // Lấy access token từ AsyncStorage
      const accessToken = await AsyncStorage.getItem("accessToken");
      console.log("Access Token for schedules:", accessToken);

      if (!accessToken) {
        console.log("No access token found");
        throw new Error("Không tìm thấy token đăng nhập");
      }

      console.log(
        "Requesting URL:",
        endpoints.workoutSessions + "me/registered-sessions/"
      );
      const response = await axiosInstance.get(
        endpoints.workoutSessions + "me/registered-sessions/",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log("Schedules API response:", response.data);

      // Kiểm tra xem có lịch tập không
      if (response.data && response.data.length > 0) {
        // Lấy ngày hiện tại (đầu ngày)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Chuyển đổi dữ liệu để phù hợp với định dạng cũ
        const formattedSchedules = response.data.map((session) => ({
          id: session.id.toString(),
          date: formatDate(session.session_date),
          time: `${formatTime(session.start_time)} - ${formatTime(
            session.end_time
          )}`,
          type:
            session.session_type === "pt_session" ? "Với Trainer" : "Tự tập",
          ptName: session.trainer_name,
          status: session.status,
          statusText: translateStatus(session.status),
          notes: session.notes,
          // Lưu timestamp để sắp xếp chính xác hơn
          timestamp: new Date(`${session.session_date}T${session.start_time}`),
        }));

        // Lọc ra các buổi tập từ hôm nay trở đi và không bị hủy
        const futureSchedules = formattedSchedules.filter(
          (schedule) =>
            schedule.timestamp >= today && schedule.status !== "cancelled"
        );

        if (futureSchedules.length > 0) {
          // Sắp xếp lịch tập tương lai theo thời gian tăng dần
          const sortedFutureSchedules = futureSchedules.sort(
            (a, b) => a.timestamp - b.timestamp
          );

          // Lấy buổi tập gần nhất trong tương lai
          setUpcomingSchedule(sortedFutureSchedules[0]);
          return sortedFutureSchedules;
        } else {
          // Nếu không có buổi tập nào trong tương lai, lấy buổi gần đây nhất trong quá khứ
          const recentSchedules = formattedSchedules.filter(
            (schedule) => schedule.status !== "cancelled"
          );

          const sortedPastSchedules = recentSchedules.sort(
            (a, b) => b.timestamp - a.timestamp // Sắp xếp giảm dần để lấy ngày gần nhất trong quá khứ
          );

          if (sortedPastSchedules.length > 0) {
            setUpcomingSchedule(sortedPastSchedules[0]);
            return sortedPastSchedules;
          } else {
            setUpcomingSchedule(null); // Không có lịch nào
            return [];
          }
        }
      } else {
        // Không có dữ liệu lịch tập
        setUpcomingSchedule(null);
        return [];
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
      // Log chi tiết lỗi để debug
      console.error(
        "Error details:",
        error.response ? error.response.data : error.message
      );
      setError("Không thể tải dữ liệu lịch tập");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainingProgress = async () => {
    try {
      setLoading(true);

      // Lấy access token từ AsyncStorage
      const accessToken = await AsyncStorage.getItem("accessToken");
      console.log("Access Token for training progress:", accessToken);

      if (!accessToken) {
        console.log("No access token found");
        throw new Error("Không tìm thấy token đăng nhập");
      }

      console.log(
        "Requesting URL:",
        endpoints.trainingProgress + "my-progress/"
      );
      const response = await axiosInstance.get(
        endpoints.trainingProgress + "my-progress/",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log("Response data:", response.data);
      console.log("Training Progress Records API response:", response.status);

      if (response.data && Array.isArray(response.data)) {
        // Sắp xếp theo ngày mới nhất
        const sortedRecords = response.data.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        // Format dữ liệu nếu cần
        const formattedRecords = sortedRecords.map((record) => {
          return {
            id: record.id,
            date: record.date,
            weight: record.weight,
            bodyFatPercentage: record.body_fat_percentage,
            muscleMass: record.muscle_mass,
            measurements: {
              chest: record.chest,
              waist: record.waist,
              hips: record.hips,
              thighs: record.thighs,
              arms: record.arms,
            },
            fitness: {
              cardioEndurance: record.cardio_endurance,
              strengthBench: record.strength_bench,
              strengthSquat: record.strength_squat,
              strengthDeadlift: record.strength_deadlift,
            },
            notes: record.notes,
            memberUsername: record.member_username,
            trainerUsername: record.trainer_username,
            workoutSession: record.workout_session,
            createdAt: record.created_at,
            // Lưu trữ dữ liệu gốc để sử dụng nếu cần
            originalData: record,
          };
        });

        // Cập nhật state với dữ liệu đã định dạng
        setTrainingProgress(formattedRecords);

        // Chỉ đặt bản ghi mới nhất nếu có state này
        if (typeof setLatestProgressRecord === "function") {
          setLatestProgressRecord(formattedRecords[0] || null);
        }
      } else {
        // Không có dữ liệu hoặc dữ liệu không đúng định dạng
        setTrainingProgress([]);

        // Chỉ đặt bản ghi mới nhất nếu có state này
        if (typeof setLatestProgressRecord === "function") {
          setLatestProgressRecord(null);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching training progress:", error);
      setError("Không thể tải dữ liệu tiến triển luyện tập");
      setLoading(false);
    }
  };

  // Đảm bảo bạn đã khởi tạo các state này trong component của mình:
  // const [trainingProgress, setTrainingProgress] = useState([]);
  // const [latestProgressRecord, setLatestProgressRecord] = useState(null); // Tùy chọn
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState(null);

  // Sử dụng trong useEffect
  // useEffect(() => {
  //   fetchTrainingProgress();
  // }, []);

  // Lấy thông tin người dùng khi component được mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Thử lấy thông tin từ Redux trước
        if (userFromRedux && userFromRedux.username) {
          setUserData(userFromRedux);
          return;
        }

        // Nếu không có thông tin trong Redux, lấy từ AsyncStorage
        const userDataString = await AsyncStorage.getItem("userData");
        if (userDataString) {
          const parsedUserData = JSON.parse(userDataString);
          setUserData(parsedUserData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
    fetchSubscription();
    fetchUpcomingSchedules(); // Thêm dòng này để gọi API lịch tập
    fetchTrainingProgress(); // Thêm dòng này để gọi API thông tin sức khỏe
  }, [userFromRedux]);

  // Đếm số thông báo chưa đọc
  const unreadCount = notifications.filter((item) => !item.read).length;

  // Component hiển thị thông tin gói tập hiện tại
  const CurrentPackage = () => {
    if (loading) {
      return (
        <View style={[styles.packageCard, styles.centerContent]}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={{ marginTop: 10 }}>Đang tải thông tin gói tập...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.packageCard, styles.centerContent]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.buttonPrimary, { marginTop: 12 }]}
            onPress={fetchSubscription}
          >
            <Text style={styles.buttonPrimaryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!userPackage) {
      return (
        <View style={[styles.packageCard, styles.centerContent]}>
          <Text style={{ fontSize: 16, marginBottom: 12 }}>
            Bạn chưa đăng ký gói tập nào
          </Text>
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => navigation.navigate("packages")} // Chuyển đến trang Packages
          >
            <Text style={styles.buttonPrimaryText}>Đăng ký ngay</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.packageCard}>
        <Text style={styles.cardTitle}>Gói tập hiện tại</Text>
        <Text style={styles.packageName}>{userPackage.name}</Text>
        <View style={styles.packageDetails}>
          <View style={styles.packageDetail}>
            <Text style={styles.detailLabel}>Giá:</Text>
            <Text style={styles.detailValue}>{userPackage.price}</Text>
          </View>
          <View style={styles.packageDetail}>
            <Text style={styles.detailLabel}>Thời hạn:</Text>
            <Text style={styles.detailValue}>{userPackage.duration}</Text>
          </View>
          <View style={styles.packageDetail}>
            <Text style={styles.detailLabel}>Buổi với PT còn lại:</Text>
            <Text style={styles.detailValue}>{userPackage.sessions} buổi</Text>
          </View>
          <View style={styles.packageDetail}>
            <Text style={styles.detailLabel}>Còn lại:</Text>
            <Text style={styles.detailValue}>
              {userPackage.remainingDays} ngày
            </Text>
          </View>
        </View>
        <Text style={styles.packageBenefits}>{userPackage.benefits}</Text>
        <TouchableOpacity
          style={styles.buttonOutline}
          onPress={() => navigation.navigate("SubscriptionDetail")}
        >
          <Text style={styles.buttonOutlineText}>Xem chi tiết</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Component hiển thị buổi tập sắp tới
  const UpcomingSession = () => {
    const [loading, setLoading] = useState(false);

    // Kiểm tra xem có lịch tập sắp tới hay không
    if (loading) {
      return (
        <View style={[styles.sessionCard, styles.centerContent]}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={{ marginTop: 10 }}>Đang tải lịch tập...</Text>
        </View>
      );
    }

    // Nếu không có lịch tập sắp tới
    if (!upcomingSchedule) {
      return (
        <View style={[styles.sessionCard, styles.centerContent]}>
          <Text style={{ fontSize: 16, marginBottom: 12 }}>
            Bạn chưa có buổi tập nào sắp tới
          </Text>
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => navigation.navigate("BookSession")}
          >
            <Text style={styles.buttonPrimaryText}>Đặt lịch ngay</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // Function để xác định màu nền dựa theo status
    const getStatusBackgroundColor = (status) => {
      switch (status) {
        case "confirmed":
          return "#e7f6e7"; // Màu xanh lá nhạt
        case "completed":
          return "#e3f2fd"; // Màu xanh dương nhạt
        case "pending":
          return "#fff8e7"; // Màu vàng nhạt
        case "cancelled":
          return "#ffebee"; // Màu đỏ nhạt
        case "rescheduled":
          return "#f3e5f5"; // Màu tím nhạt
        default:
          return "#f5f5f5"; // Màu xám nhạt cho các trạng thái khác
      }
    };

    // Function để xác định màu chữ dựa theo status
    const getStatusTextColor = (status) => {
      switch (status) {
        case "confirmed":
          return "#2e7d32"; // Màu xanh lá đậm
        case "completed":
          return "#1565c0"; // Màu xanh dương đậm
        case "pending":
          return "#ff8f00"; // Màu cam
        case "cancelled":
          return "#c62828"; // Màu đỏ đậm
        case "rescheduled":
          return "#7b1fa2"; // Màu tím đậm
        default:
          return "#616161"; // Màu xám đậm cho các trạng thái khác
      }
    };
    // Hiển thị lịch tập sắp tới nếu có
    return (
      <View style={styles.sessionCard}>
        <Text style={styles.cardTitle}>Buổi tập sắp tới</Text>
        <View style={styles.sessionHeader}>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.sessionDate}>{upcomingSchedule.date}</Text>
            <Text style={styles.sessionTime}>
              Time: {upcomingSchedule.time}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusBackgroundColor(
                  upcomingSchedule.status
                ),
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: getStatusTextColor(upcomingSchedule.status),
                },
              ]}
            >
              {upcomingSchedule.statusText ||
                translateStatus(upcomingSchedule.status)}
            </Text>
          </View>
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionType}>{upcomingSchedule.type}</Text>
          {upcomingSchedule.ptName && (
            <Text style={styles.ptName}>
              Trainer: {upcomingSchedule.ptName}
            </Text>
          )}
        </View>
        <View style={styles.sessionActions}>
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => navigation.navigate("BookSession")}
          >
            <Text style={styles.buttonPrimaryText}>Đặt lịch mới</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonOutline}
            onPress={() => navigation.navigate("Schedule")}
          >
            <Text style={styles.buttonOutlineText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  // Component hiển thị tiến độ tập luyện

  // Component ProgressSection trong file home.js
  const ProgressSection = () => {
    // Dùng để hiển thị sự thay đổi của các chỉ số
    const calculateChange = (currentValue, previousValue) => {
      if (!previousValue || previousValue === 0) return null;
      return currentValue - previousValue;
    };

    // Format sự thay đổi với dấu + hoặc -
    const formatChange = (change, reverse = false) => {
      if (change === null) return "";

      // Đối với một số chỉ số (như body fat), giảm là tích cực
      // Đối với một số chỉ số khác (như muscle mass), tăng là tích cực
      const isPositive = reverse ? change < 0 : change > 0;

      return `${change > 0 ? "+" : ""}${change.toFixed(1)}`;
    };

    // Nếu đang tải dữ liệu
    if (loading) {
      return (
        <View style={[styles.progressCard, styles.centerContent]}>
          <ActivityIndicator size="large" color="#1a73e8" styles />
          <Text style={{ marginTop: 10 }}>Đang tải tiến độ tập luyện...</Text>
        </View>
      );
    }

    // Nếu có lỗi khi tải dữ liệu
    if (error) {
      return (
        <View style={[styles.progressCard, styles.centerContent]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.buttonPrimary, { marginTop: 12 }]}
            onPress={fetchTrainingProgress}
          >
            <Text style={styles.buttonPrimaryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Nếu không có dữ liệu
    if (!trainingProgress || trainingProgress.length === 0) {
      return (
        <View style={[styles.progressCard, styles.centerContent]}>
          <Text style={{ fontSize: 16, marginBottom: 12 }}>
            Chưa có dữ liệu tiến độ tập luyện
          </Text>
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => navigation.navigate("AddProgress")} // Giả sử có màn hình thêm tiến độ
          >
            <Text style={styles.buttonPrimaryText}>Thêm dữ liệu</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Lấy bản ghi mới nhất và bản ghi trước đó (nếu có)
    const latestRecord = trainingProgress[0];
    const previousRecord =
      trainingProgress.length > 1 ? trainingProgress[1] : null;

    // Tính toán sự thay đổi
    const weightChange = calculateChange(
      latestRecord.weight,
      previousRecord?.weight
    );
    const fatChange = calculateChange(
      latestRecord.bodyFatPercentage,
      previousRecord?.bodyFatPercentage
    );
    const muscleChange = calculateChange(
      latestRecord.muscleMass,
      previousRecord?.muscleMass
    );

    // Tính BMI (nếu có chiều cao trong dữ liệu)
    let bmi = null;
    let bmiChange = null;

    if (latestRecord.originalData && latestRecord.originalData.height) {
      const heightInMeters = latestRecord.originalData.height / 100; // chuyển từ cm sang m
      bmi = latestRecord.weight / (heightInMeters * heightInMeters);

      if (
        previousRecord &&
        previousRecord.originalData &&
        previousRecord.originalData.height
      ) {
        const prevHeightInMeters = previousRecord.originalData.height / 100;
        const prevBmi =
          previousRecord.weight / (prevHeightInMeters * prevHeightInMeters);
        bmiChange = bmi - prevBmi;
      }
    }

    // Chuẩn bị dữ liệu cho biểu đồ - lấy tối đa 6 bản ghi gần nhất (nếu có)
    const chartData = {
      labels: [],
      datasets: [
        {
          data: [],
          color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})`, // màu blue cho cân nặng
          strokeWidth: 2,
        },
        {
          data: [],
          color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`, // màu red cho tỷ lệ mỡ
          strokeWidth: 2,
        },
        {
          data: [],
          color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`, // màu green cho tỷ lệ cơ
          strokeWidth: 2,
        },
      ],
      legend: ["Cân nặng", "Tỷ lệ mỡ", "Tỷ lệ cơ"],
    };

    const recentRecords = trainingProgress.slice(0, 6).reverse(); // Lấy tối đa 6 bản ghi và đảo ngược để hiển thị từ cũ tới mới

    recentRecords.forEach((record) => {
      // Chỉ hiển thị tháng/ngày cho labels
      const date = new Date(record.date);
      chartData.labels.push(`${date.getDate()}/${date.getMonth() + 1}`);

      // Thêm dữ liệu cho các dataset
      chartData.datasets[0].data.push(record.weight);
      chartData.datasets[1].data.push(record.bodyFatPercentage);
      chartData.datasets[2].data.push(record.muscleMass);
    });

    // Lấy chiều rộng màn hình
    const screenWidth = Dimensions.get("window").width - 32; // trừ đi padding

    return (
      <View style={styles.progressCard}>
        <Text style={styles.cardTitle}>Tiến độ tập luyện</Text>
        <View style={styles.chartContainer}>
          <LineChart
            data={chartData}
            width={screenWidth}
            height={160}
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: "4",
                strokeWidth: "1",
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            legend={chartData.legend}
          />
        </View>

        {/* Thông số chính */}
        <View style={styles.progressStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Cân nặng</Text>
            <Text style={styles.statValue}>{latestRecord.weight} kg</Text>
            {weightChange !== null && (
              <Text
                style={[
                  styles.statDiff,
                  weightChange < 0 ? styles.positive : null,
                ]}
              >
                {formatChange(weightChange)}
              </Text>
            )}
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tỷ lệ mỡ</Text>
            <Text style={styles.statValue}>
              {latestRecord.bodyFatPercentage}%
            </Text>
            {fatChange !== null && (
              <Text
                style={[
                  styles.statDiff,
                  fatChange < 0 ? styles.positive : null,
                ]}
              >
                {formatChange(fatChange)}
              </Text>
            )}
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tỷ lệ cơ</Text>
            <Text style={styles.statValue}>{latestRecord.muscleMass}%</Text>
            {muscleChange !== null && (
              <Text
                style={[
                  styles.statDiff,
                  muscleChange > 0 ? styles.positive : null,
                ]}
              >
                {formatChange(muscleChange)}
              </Text>
            )}
          </View>
        </View>

        {/* Số đo cơ thể */}
        <View style={styles.measurementsContainer}>
          <Text style={[styles.cardTitle, { marginTop: 16, marginBottom: 8 }]}>
            Số đo cơ thể
          </Text>
          <View style={styles.measurementsGrid}>
            <View style={styles.measurementItem}>
              <Text style={styles.measurementLabel}>Ngực</Text>
              <Text style={styles.measurementValue}>
                {latestRecord.measurements.chest} cm
              </Text>
              {previousRecord && (
                <Text
                  style={[
                    styles.statDiff,
                    latestRecord.measurements.chest -
                      previousRecord.measurements.chest >
                    0
                      ? styles.positive
                      : null,
                  ]}
                >
                  {formatChange(
                    latestRecord.measurements.chest -
                      previousRecord.measurements.chest
                  )}
                </Text>
              )}
            </View>

            <View style={styles.measurementItem}>
              <Text style={styles.measurementLabel}>Eo</Text>
              <Text style={styles.measurementValue}>
                {latestRecord.measurements.waist} cm
              </Text>
              {previousRecord && (
                <Text
                  style={[
                    styles.statDiff,
                    latestRecord.measurements.waist -
                      previousRecord.measurements.waist <
                    0
                      ? styles.positive
                      : null,
                  ]}
                >
                  {formatChange(
                    latestRecord.measurements.waist -
                      previousRecord.measurements.waist
                  )}
                </Text>
              )}
            </View>

            <View style={styles.measurementItem}>
              <Text style={styles.measurementLabel}>Hông</Text>
              <Text style={styles.measurementValue}>
                {latestRecord.measurements.hips} cm
              </Text>
              {previousRecord && (
                <Text
                  style={[
                    styles.statDiff,
                    latestRecord.measurements.hips -
                      previousRecord.measurements.hips <
                    0
                      ? styles.positive
                      : null,
                  ]}
                >
                  {formatChange(
                    latestRecord.measurements.hips -
                      previousRecord.measurements.hips
                  )}
                </Text>
              )}
            </View>

            <View style={styles.measurementItem}>
              <Text style={styles.measurementLabel}>Đùi</Text>
              <Text style={styles.measurementValue}>
                {latestRecord.measurements.thighs} cm
              </Text>
              {previousRecord && (
                <Text
                  style={[
                    styles.statDiff,
                    latestRecord.measurements.thighs -
                      previousRecord.measurements.thighs <
                    0
                      ? styles.positive
                      : null,
                  ]}
                >
                  {formatChange(
                    latestRecord.measurements.thighs -
                      previousRecord.measurements.thighs
                  )}
                </Text>
              )}
            </View>

            <View style={styles.measurementItem}>
              <Text style={styles.measurementLabel}>Cánh tay</Text>
              <Text style={styles.measurementValue}>
                {latestRecord.measurements.arms} cm
              </Text>
              {previousRecord && (
                <Text
                  style={[
                    styles.statDiff,
                    latestRecord.measurements.arms -
                      previousRecord.measurements.arms >
                    0
                      ? styles.positive
                      : null,
                  ]}
                >
                  {formatChange(
                    latestRecord.measurements.arms -
                      previousRecord.measurements.arms
                  )}
                </Text>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.buttonOutline, { marginTop: 16 }]}
          onPress={() => navigation.navigate("Progress")}
        >
          <Text style={styles.buttonOutlineText}>Xem chi tiết</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Component hiển thị thông báo
  const NotificationsSection = () => (
    <View style={styles.notificationsCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>Thông báo</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
      {notifications.slice(0, 3).map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.notificationItem,
            !item.read && styles.unreadNotification,
          ]}
          onPress={() => Alert.alert("Đánh dấu đã đọc thông báo này")}
        >
          <View style={styles.notificationContent}>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>{item.time}</Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={styles.buttonOutline}
        onPress={() => navigation.navigate("Notifications")}
      >
        <Text style={styles.buttonOutlineText}>Xem tất cả</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: "/api/placeholder/40/40" }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.welcomeText}>Xin chào,</Text>
            <Text style={styles.userName}>
              {userData && userData.first_name && userData.last_name
                ? `${userData.first_name} ${userData.last_name}`
                : "Người dùng"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <CurrentPackage />
        <UpcomingSession />
        <ProgressSection />
        <NotificationsSection />
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#e0e0e0",
  },
  welcomeText: {
    fontSize: 14,
    color: "#666666",
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222222",
  },
  notificationButton: {
    position: "relative",
    padding: 8,
  },
  bellIcon: {
    fontSize: 24,
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#f44336",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  packageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  errorText: {
    color: "#f44336",
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333333",
  },
  packageName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a73e8",
    marginBottom: 8,
  },
  packageDetails: {
    marginBottom: 12,
  },
  packageDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 14,
    color: "#666666",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  packageBenefits: {
    fontSize: 14,
    color: "#555555",
    marginVertical: 8,
    lineHeight: 20,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#1a73e8",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonPrimary: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  sessionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  dateTimeContainer: {
    flexDirection: "column",
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },
  sessionTime: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666666",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sessionInfo: {
    marginBottom: 16,
  },
  sessionType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 4,
  },
  ptName: {
    fontSize: 14,
    color: "#666666",
  },
  sessionActions: {
    flexDirection: "row",
  },
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartContainer: {
    height: 150,
    marginVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chartPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  progressStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    padding: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 2,
  },
  statDiff: {
    fontSize: 12,
    color: "#f44336",
  },
  positive: {
    color: "#4caf50",
  },
  notificationsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  measurementsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  measurementsGrid: {
    flexDirection: "column",
    flexWrap: "wrap",
    marginHorizontal: -4,
    justifyContent: "center",
    alignItems: "center",
  },
  measurementItem: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    marginBottom: 8,
    alignItems: "center",
  },

  measurementLabel: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 4,
  },
  measurementValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 2,
  },

  badge: {
    backgroundColor: "#f44336",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "bold",
  },
  notificationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  unreadNotification: {
    backgroundColor: "#f8f9ff",
  },
  notificationContent: {
    flex: 1,
    paddingRight: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#333333",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#999999",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1a73e8",
  },
  spacer: {
    height: 80,
  },
});

export default Home;
