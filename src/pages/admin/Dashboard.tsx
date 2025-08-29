import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, GraduationCap, UserPlus, Calendar, LogOut, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import TimetableGrid from '@/components/TimetableGrid';
import WeeklySchedule from '@/components/WeeklySchedule';
import MarklyLogo from '@/components/MarklyLogo';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
  section?: string;
  roll_number?: string;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  teacher_id: string;
  schedule?: any;
  teacher?: { name: string };
  _count?: { enrollments: number };
}

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // Form states
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student' as 'admin' | 'teacher' | 'student',
    section: '',
    rollNumber: ''
  });

  const [classForm, setClassForm] = useState({
    name: '',
    description: '',
    teacherId: '',
    schedule: {}
  });

  const [enrollmentForm, setEnrollmentForm] = useState({
    classId: '',
    section: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch classes with teacher info and enrollment counts
      const { data: classesData } = await supabase
        .from('classes')
        .select(`
          *,
          teacher:profiles!classes_teacher_id_fkey(name),
          enrollments(count)
        `);

      setUsers(usersData || []);
      setClasses(classesData || []);
      setTeachers(usersData?.filter(u => u.role === 'teacher') || []);
      setStudents(usersData?.filter(u => u.role === 'student') || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!userForm.password) {
      toast.error('Please enter a password');
      return;
    }
    
    try {
      console.log('Creating user with:', {
        email: userForm.email,
        role: userForm.role,
        password: userForm.password
      });
      
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userForm.email,
          password: userForm.password,
          name: userForm.name,
          role: userForm.role,
          section: userForm.section,
          rollNumber: userForm.rollNumber
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      console.log('User created successfully:', data);
      
      toast.success(`✅ User created successfully! Email: ${userForm.email}`);
      setUserForm({ name: '', email: '', password: '', role: 'student', section: '', rollNumber: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message || 'Unknown error'}`);
    }
  };

  const createClass = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: classForm.name,
          description: classForm.description,
          teacher_id: classForm.teacherId,
          schedule: classForm.schedule
        });

      if (error) throw error;

      toast.success('Class created successfully');
      setClassForm({
        name: '',
        description: '',
        teacherId: '',
        schedule: {}
      });
      fetchData();
    } catch (error: any) {
      console.error('Error creating class:', error);
      toast.error(error.message || 'Failed to create class');
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('secure-admin-operations', {
        body: {
          operation: 'deleteUser',
          data: { userIdToDelete: userId }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;

    try {
      const { data, error } = await supabase.functions.invoke('secure-admin-operations', {
        body: {
          operation: 'updateUser',
          data: {
            userId: editingUser.id,
            updates: {
              name: editingUser.name,
              email: editingUser.email,
              role: editingUser.role,
              section: editingUser.section,
              rollNumber: editingUser.roll_number
            }
          }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User updated successfully');
      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    }
  };

  const deleteClass = async (classId: string) => {
    try {
      // First delete all enrollments for this class
      await supabase
        .from('enrollments')
        .delete()
        .eq('class_id', classId);

      // Then delete the class
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;

      toast.success('Class deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast.error(error.message || 'Failed to delete class');
    }
  };

  const updateClass = async () => {
    if (!editingClass) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: editingClass.name,
          description: editingClass.description,
          teacher_id: editingClass.teacher_id,
          schedule: editingClass.schedule
        })
        .eq('id', editingClass.id);

      if (error) throw error;

      toast.success('Class updated successfully');
      setEditingClass(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating class:', error);
      toast.error(error.message || 'Failed to update class');
    }
  };

  const enrollStudent = async () => {
    try {
      // Get all students from the selected section
      const { data: sectionStudents, error: fetchError } = await supabase
        .from('profiles')
        .select('id, roll_number')
        .eq('role', 'student')
        .eq('section', enrollmentForm.section);

      if (fetchError) throw fetchError;

      if (!sectionStudents || sectionStudents.length === 0) {
        toast.error('No students found in this section');
        return;
      }

      // Check for existing enrollments to avoid duplicates
      const { data: existingEnrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', enrollmentForm.classId)
        .in('student_id', sectionStudents.map(s => s.id));

      const existingStudentIds = existingEnrollments?.map(e => e.student_id) || [];
      const newEnrollments = sectionStudents
        .filter(student => !existingStudentIds.includes(student.id))
        .map(student => ({
          class_id: enrollmentForm.classId,
          student_id: student.id,
          roll_number: student.roll_number
        }));

      if (newEnrollments.length === 0) {
        toast.error('All students from this section are already enrolled in this class');
        return;
      }

      const { error } = await supabase
        .from('enrollments')
        .insert(newEnrollments);

      if (error) throw error;

      toast.success(`Successfully enrolled ${newEnrollments.length} students from section ${enrollmentForm.section}`);
      setEnrollmentForm({ classId: '', section: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error enrolling students:', error);
      toast.error(error.message || 'Failed to enroll students');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="container mx-auto px-4 lg:px-6 py-4 lg:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between p-4 lg:p-6 bg-card/80 backdrop-blur-sm rounded-xl lg:rounded-2xl shadow-elegant border border-border/20">
            <div className="flex items-center gap-3 lg:gap-4">
              <MarklyLogo size="md" showText={false} className="lg:hidden" />
              <MarklyLogo size="md" className="hidden lg:flex" />
              <div className="hidden sm:block">
                <h1 className="text-2xl lg:text-4xl font-bold gradient-markly bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-lg">
                  Manage users, classes, and enrollments with Markly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              {profile && (
                <div className="text-right hidden md:block">
                  <p className="font-medium text-sm lg:text-base">{profile.name}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">{profile.email}</p>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  try {
                    await signOut();
                    toast.success('Logged out successfully');
                    navigate('/login', { replace: true });
                  } catch (error) {
                    toast.error('Logout failed');
                    console.error('Logout error:', error);
                  }
                }}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-10">
          <Card className="shadow-elegant border-0 transition-smooth hover:shadow-glow">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="p-2 lg:p-3 bg-primary/10 rounded-lg lg:rounded-xl">
                  <Users className="h-5 w-5 lg:h-8 lg:w-8 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Total Users</p>
                  <p className="text-xl lg:text-3xl font-bold">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-elegant border-0 transition-smooth hover:shadow-glow">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="p-2 lg:p-3 bg-success/10 rounded-lg lg:rounded-xl">
                  <GraduationCap className="h-5 w-5 lg:h-8 lg:w-8 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Teachers</p>
                  <p className="text-xl lg:text-3xl font-bold">{teachers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-elegant border-0 transition-smooth hover:shadow-glow">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="p-2 lg:p-3 bg-secondary/10 rounded-lg lg:rounded-xl">
                  <UserPlus className="h-5 w-5 lg:h-8 lg:w-8 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Students</p>
                  <p className="text-xl lg:text-3xl font-bold">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-elegant border-0 transition-smooth hover:shadow-glow">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="p-2 lg:p-3 bg-warning/10 rounded-lg lg:rounded-xl">
                  <Calendar className="h-5 w-5 lg:h-8 lg:w-8 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Classes</p>
                  <p className="text-xl lg:text-3xl font-bold">{classes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8 lg:mb-10">
          {/* Create User Form */}
          <Card className="shadow-elegant border-0 transition-smooth hover:shadow-glow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg lg:text-xl font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                Create New User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="userName" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Name</Label>
                  <Input
                    id="userName"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="Enter full name"
                    className="transition-smooth"
                  />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmail" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="Enter email address"
                  className="bg-white/50 border-slate-200 focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Enter password"
                  required
                  className="bg-white/50 border-slate-200 focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userRole" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Role</Label>
                <Select value={userForm.role} onValueChange={(value: any) => setUserForm({ ...userForm, role: value })}>
                  <SelectTrigger className="bg-white/50 border-slate-200">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {userForm.role === 'student' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="userSection" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Section</Label>
                    <Select value={userForm.section} onValueChange={(value) => setUserForm({ ...userForm, section: value })}>
                      <SelectTrigger className="bg-white/50 border-slate-200">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="A">Section A</SelectItem>
                        <SelectItem value="B">Section B</SelectItem>
                        <SelectItem value="C">Section C</SelectItem>
                        <SelectItem value="D">Section D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userRollNumber" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Roll Number</Label>
                    <Input
                      id="userRollNumber"
                      value={userForm.rollNumber}
                      onChange={(e) => setUserForm({ ...userForm, rollNumber: e.target.value })}
                      placeholder="Enter roll number"
                      className="bg-white/50 border-slate-200 focus:border-blue-400 transition-colors"
                    />
                  </div>
                </>
              )}
              <Button 
                onClick={createUser} 
                className="w-full transition-smooth"
              >
                Create User
              </Button>
            </CardContent>
          </Card>

          {/* Create Class Form */}
          <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-emerald-500" />
                Create New Class
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="className" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Class Name</Label>
                <Input
                  id="className"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="Enter class name"
                  className="bg-white/50 border-slate-200 focus:border-emerald-400 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classDescription" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</Label>
                <Textarea
                  id="classDescription"
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  placeholder="Enter class description"
                  className="bg-white/50 border-slate-200 focus:border-emerald-400 transition-colors min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classTeacher" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Teacher</Label>
                <Select value={classForm.teacherId} onValueChange={(value) => setClassForm({ ...classForm, teacherId: value })}>
                  <SelectTrigger className="bg-white/50 border-slate-200">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name} ({teacher.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Weekly Schedule</Label>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200">
                  <TimetableGrid 
                    schedule={classForm.schedule}
                    onScheduleChange={(newSchedule) => setClassForm({ ...classForm, schedule: newSchedule })}
                  />
                </div>
              </div>
              <Button 
                onClick={createClass} 
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Create Class
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Enroll Students by Section */}
        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 mb-10">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-500" />
              Enroll Section in Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="enrollClass" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Class</Label>
                <Select value={enrollmentForm.classId} onValueChange={(value) => setEnrollmentForm({ ...enrollmentForm, classId: value })}>
                  <SelectTrigger className="bg-white/50 border-slate-200">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollSection" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Section</Label>
                <Select value={enrollmentForm.section} onValueChange={(value) => setEnrollmentForm({ ...enrollmentForm, section: value })}>
                  <SelectTrigger className="bg-white/50 border-slate-200">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="A">Section A</SelectItem>
                    <SelectItem value="B">Section B</SelectItem>
                    <SelectItem value="C">Section C</SelectItem>
                    <SelectItem value="D">Section D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={enrollStudent} 
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Enroll Section
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Schedule */}
        <div className="mb-8">
          <WeeklySchedule showSectionFilter={true} userRole="admin" />
        </div>
        
        {/* Users List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <Card className="shadow-elegant border-0">
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.section && (
                        <p className="text-xs text-muted-foreground">Section: {user.section}</p>
                      )}
                      {user.roll_number && (
                        <p className="text-xs text-muted-foreground">Roll: {user.roll_number}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        user.role === 'admin' ? 'destructive' :
                        user.role === 'teacher' ? 'default' : 'secondary'
                      }>
                        {user.role}
                      </Badge>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                          </DialogHeader>
                          {editingUser && (
                            <div className="space-y-4">
                              <div>
                                <Label>Name</Label>
                                <Input
                                  value={editingUser.name}
                                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Email</Label>
                                <Input
                                  value={editingUser.email}
                                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Role</Label>
                                <Select
                                  value={editingUser.role}
                                  onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="teacher">Teacher</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {editingUser.role === 'student' && (
                                <>
                                  <div>
                                    <Label>Section</Label>
                                    <Input
                                      value={editingUser.section || ''}
                                      onChange={(e) => setEditingUser({ ...editingUser, section: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <Label>Roll Number</Label>
                                    <Input
                                      value={editingUser.roll_number || ''}
                                      onChange={(e) => setEditingUser({ ...editingUser, roll_number: e.target.value })}
                                    />
                                  </div>
                                </>
                              )}
                              <Button onClick={updateUser} className="w-full">
                                Update User
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {user.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteUser(user.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Classes List */}
          <Card className="shadow-elegant border-0">
            <CardHeader>
              <CardTitle>Recent Classes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {classes.slice(0, 5).map((cls) => (
                  <div key={cls.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{cls.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {cls._count?.enrollments || 0} students
                        </Badge>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingClass(cls)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Class</DialogTitle>
                            </DialogHeader>
                            {editingClass && (
                              <div className="space-y-4">
                                <div>
                                  <Label>Class Name</Label>
                                  <Input
                                    value={editingClass.name}
                                    onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>Description</Label>
                                  <Textarea
                                    value={editingClass.description || ''}
                                    onChange={(e) => setEditingClass({ ...editingClass, description: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>Teacher</Label>
                                  <Select
                                    value={editingClass.teacher_id}
                                    onValueChange={(value) => setEditingClass({ ...editingClass, teacher_id: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {teachers.map((teacher) => (
                                        <SelectItem key={teacher.id} value={teacher.id}>
                                          {teacher.name} ({teacher.email})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Weekly Schedule</Label>
                                  <TimetableGrid 
                                    schedule={editingClass.schedule || {}}
                                    onScheduleChange={(newSchedule) => setEditingClass({ ...editingClass, schedule: newSchedule })}
                                  />
                                </div>
                                <Button onClick={updateClass} className="w-full">
                                  Update Class
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Class</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {cls.name}? This will also remove all student enrollments. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteClass(cls.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Teacher: {cls.teacher?.name || 'Not assigned'}
                    </p>
                    {cls.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {cls.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;