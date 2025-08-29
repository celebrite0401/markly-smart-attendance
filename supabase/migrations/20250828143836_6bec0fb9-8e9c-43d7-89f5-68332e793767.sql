-- Create user roles enum
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');

-- Create users table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'student',
  face_descriptor JSONB,
  notification_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule JSONB, -- {day: 'monday', time: '09:00', duration: 60}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Create enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  roll_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  extended BOOLEAN DEFAULT FALSE,
  qr_secret TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'pending', 'absent', 'rejected')),
  checkin_time TIMESTAMP WITH TIME ZONE,
  face_score FLOAT,
  liveness BOOLEAN,
  photo_url TEXT,
  proof_hash TEXT,
  prev_hash TEXT,
  reviewer_id UUID REFERENCES public.profiles(id),
  review_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Classes policies
CREATE POLICY "Everyone can view classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Teachers can manage their classes" ON public.classes FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "Admins can manage all classes" ON public.classes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Enrollments policies
CREATE POLICY "Students can view their enrollments" ON public.enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers can view their class enrollments" ON public.enrollments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid())
);
CREATE POLICY "Admins can manage enrollments" ON public.enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Sessions policies
CREATE POLICY "Teachers can manage their sessions" ON public.sessions FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "Students can view sessions for their classes" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE class_id = sessions.class_id AND student_id = auth.uid())
);

-- Attendance policies
CREATE POLICY "Students can view their attendance" ON public.attendance FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can insert their attendance" ON public.attendance FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teachers can view/update attendance for their sessions" ON public.attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND teacher_id = auth.uid())
);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', false);

-- Storage policies
CREATE POLICY "Teachers can upload photos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'attendance-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Teachers can view photos" ON storage.objects FOR SELECT USING (
  bucket_id = 'attendance-photos' AND 
  auth.role() = 'authenticated'
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    NEW.email,
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();