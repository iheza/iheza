import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { studentService } from '../../services/studentService';

const initialState = {
  students: [],
  loading: false,
  error: null,
};

export const fetchStudents = createAsyncThunk(
  'students/fetchAll',
  async ({ classFilter = null, chainFilter = null } = {}, { rejectWithValue }) => {
    try {
      return await studentService.getStudents(classFilter, chainFilter);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createStudent = createAsyncThunk(
  'students/create',
  async (studentData, { rejectWithValue }) => {
    try {
      return await studentService.createStudent(studentData);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateStudent = createAsyncThunk(
  'students/update',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      return await studentService.updateStudent(id, updates);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteStudent = createAsyncThunk(
  'students/delete',
  async (id, { rejectWithValue }) => {
    try {
      await studentService.deleteStudent(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const bulkUploadStudents = createAsyncThunk(
  'students/bulkUpload',
  async (studentsData, { rejectWithValue }) => {
    try {
      return await studentService.bulkUploadStudents(studentsData);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const studentSlice = createSlice({

  name: 'students',
  initialState,
  reducers: {
    clearStudentsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.students = action.payload;
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createStudent.fulfilled, (state, action) => {
        state.students.push(action.payload);
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        const index = state.students.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.students[index] = action.payload;
        }
      })
      .addCase(deleteStudent.fulfilled, (state, action) => {
        state.students = state.students.filter(s => s.id !== action.payload);
      })
      .addCase(bulkUploadStudents.pending, (state) => {
        state.loading = true;
      })
      .addCase(bulkUploadStudents.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(bulkUploadStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

  },
});

export const { clearStudentsError } = studentSlice.actions;
export const selectStudents = (state) => state.students.students;
export const selectStudentsLoading = (state) => state.students.loading;
export default studentSlice.reducer;
