import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ui/protected-route";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import TeacherDashboard from "@/pages/teacher/Dashboard";
import SessionView from "@/pages/teacher/SessionView";
import TeacherAttendanceHistory from "@/pages/teacher/AttendanceHistory";
import ClassRegister from "@/pages/teacher/ClassRegister";
import ClassSelection from "@/pages/teacher/ClassSelection";
import TeacherExportData from "@/pages/teacher/ExportData";
import TeacherManageStudents from "@/pages/teacher/ManageStudents";
import TeacherSettings from "@/pages/teacher/Settings";
import StudentHome from "@/pages/student/Home";
import Checkin from "@/pages/student/Checkin";
import StudentScan from "@/pages/student/Scan";
import StudentAttendanceHistory from "@/pages/student/AttendanceHistory";
import StudentAttendanceTracker from "@/pages/student/AttendanceTracker";
import AdminDashboard from "@/pages/admin/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            
            {/* Teacher Routes */}
            <Route path="/teacher/dashboard" element={
              <ProtectedRoute requireRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            } />
            <Route path="/teacher/session/:classId" element={
              <ProtectedRoute requireRole="teacher">
                <SessionView />
              </ProtectedRoute>
            } />
            <Route path="/teacher/attendance-history" element={
              <ProtectedRoute requireRole="teacher">
                <TeacherAttendanceHistory />
              </ProtectedRoute>
            } />
            <Route path="/teacher/class-register/:classId" element={
              <ProtectedRoute requireRole="teacher">
                <ClassRegister />
              </ProtectedRoute>
            } />
            <Route path="/teacher/class-selection" element={
              <ProtectedRoute requireRole="teacher">
                <ClassSelection />
              </ProtectedRoute>
            } />
            <Route path="/teacher/settings" element={
              <ProtectedRoute requireRole="teacher">
                <TeacherSettings />
              </ProtectedRoute>
            } />
            <Route path="/teacher/export-data" element={
              <ProtectedRoute requireRole="teacher">
                <TeacherExportData />
              </ProtectedRoute>
            } />
            <Route path="/teacher/manage-students" element={
              <ProtectedRoute requireRole="teacher">
                <TeacherManageStudents />
              </ProtectedRoute>
            } />
            
            {/* Student Routes */}
            <Route path="/student/home" element={
              <ProtectedRoute requireRole="student">
                <StudentHome />
              </ProtectedRoute>
            } />
            <Route path="/student/checkin" element={
              <ProtectedRoute requireRole="student">
                <Checkin />
              </ProtectedRoute>
            } />
            <Route path="/student/checkin/:sessionId" element={
              <ProtectedRoute requireRole="student">
                <Checkin />
              </ProtectedRoute>
            } />
            <Route path="/student/scan" element={
              <ProtectedRoute requireRole="student">
                <StudentScan />
              </ProtectedRoute>
            } />
            <Route path="/student/attendance-history" element={
              <ProtectedRoute requireRole="student">
                <StudentAttendanceHistory />
              </ProtectedRoute>
            } />
            <Route path="/student/attendance-tracker" element={
              <ProtectedRoute requireRole="student">
                <StudentAttendanceTracker />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;