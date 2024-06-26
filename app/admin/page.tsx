'use client'
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import QuizDetails from '../components/QuizDetails';
import { formatDate } from '../Date';
import toast from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';

const AdminPage = () => {
  const [user, setUser] = useState(auth.currentUser);
  const router = useRouter();
  const [userData, setUserData] = useState<any[]>([]);
  const [quizData, setQuizData] = useState<any>([]);
  const [lockStatus, setLockStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchQuizData();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        //these are the admin user uid's. Yes i wrote it in the code. Go cry about it.
        if (user.uid === 'faNLMo6zT2XhXH0dTBaJQunXe9B3' || user.uid === 'BiiqrNezHSM8NTF1P5yNkkX4x8F2') {
          setUser(user);
        } else {
          toast.error("Unauthorized :(");
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
      fetchAdminData();
    });
  }, []);

  async function fetchAdminData() {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const userDataArray: any = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email === 'admindsce@dsce.com' || data.email === 'testadmin@dsce.com') {
          // Exclude admin user
        } else {
          userDataArray.push(data);
        }
      });
      userDataArray.sort((a: any, b: any) => a.USN.localeCompare(b.USN));
      setUserData(userDataArray);
    } catch (error) {
      console.error("Error fetching admin data: ", error);
      toast.error("Error fetching admin data");

    }
  }

  async function fetchQuizData() {
    try {
      const querySnapshot = await getDocs(collection(db, 'quizzes'));
      const quizNameArray = querySnapshot.docs
        .filter(doc => !doc.data().data.isDeleted)
        .map(doc => doc.data().data.quizName);
      setQuizData(quizNameArray);
    } catch (error) {
      console.error('Error fetching quiz data:', error);
      toast.error("Error fetching quiz data")
    }
  }

  async function handleDeleteQuiz(quizName: string) {
    try {
      const querySnapshot = await getDocs(collection(db, 'quizzes'));
      const quizDoc = querySnapshot.docs.find(doc => doc.data().data.quizName === quizName);

      if (quizDoc) {
        await updateDoc(doc(db, 'quizzes', quizDoc.id), {
          'data.isDeleted': true,
        });
        fetchQuizData();
        toast.success(`Quiz "${quizName}" marked as deleted.`);
      } else {
        console.error('Quiz not found:', quizName);
        toast.error(`Quiz "${quizName}" not found.`);
      }
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error(`Error marking quiz "${quizName}" as deleted.`);
    }
  };

  async function handleLockUnlockQuiz(quizName: any) {
    const querySnapshot = await getDocs(collection(db, 'quizzes'));
    const quizDoc = querySnapshot.docs.find(doc => doc.data().data.quizName === quizName);

    if (quizDoc) {
      const currentLockStatus = quizDoc.data().data.isLocked;
      await updateDoc(doc(db, 'quizzes', quizDoc.id), {
        'data.isLocked': !currentLockStatus,
      });
      setLockStatus(prevStatus => ({ ...prevStatus, [quizName]: !currentLockStatus }));
      fetchQuizData();
      toast.success(`Quiz "${quizName}" ${currentLockStatus ? 'unlocked' : 'locked'} successfully.`);
    } else {
      console.error('Quiz not found:', quizName);
      toast.error(`Quiz "${quizName}" not found.`);
    }
  };

  function calculateTotalScore(quizData: any) {
    let totalScore = 0;
    let totalQuestions = 0;

    quizData.forEach((quiz: any) => {
      totalScore += quiz.score;
      totalQuestions += quiz.totalQuestions;
    });

    return `${totalScore} / ${totalQuestions}`;
  }

  const handleDownloadExcel = () => {
    var d = new Date();
    var n = formatDate(d);

    const sortedUserData = [...userData].sort((a: any, b: any) => a.USN.localeCompare(b.USN));
    const flatData = sortedUserData.map(user => {
      const userFlat = {
        'USN': user.USN,
        'Email': user.email,
        'Student Name': user.displayName,
        'Total Score': calculateTotalScore(user.quizData),

        ...user.quizData.reduce((acc: any, quiz: any, index: any) => ({
          ...acc,
          [` ${quiz.quizName} `]: `${quiz.score} / ${quiz.totalQuestions}`,
          [`${quiz.quizName} Time`]: quiz.time,
          [`${quiz.quizName} Quiz ID`]: quiz.quizId,
          [`${quiz.quizName} Course`]: quiz.course,
          [`${quiz.quizName} Course Code`]: quiz.courseCode,
        }), {}),
      };
      return userFlat;
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Student Data Sheet ${n}`);
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAsExcelFile(excelBuffer, `Student Data Sheet ${n} .xlsx`);
  };

  // Function to handle downloading individual quiz data
  const handleDownloadQuiz = (quizName: any) => {
    const quizData = userData.map(user => {
      const userQuiz = user.quizData.find((quiz: any) => quiz.quizName === quizName);
      return {
        'USN': user.USN,
        'Student Name': user.displayName,
        'Quiz Name': userQuiz ? userQuiz.quizName : '',
        'Score': userQuiz ? `${userQuiz.score} / ${userQuiz.totalQuestions}` : '',
        'Time': userQuiz ? userQuiz.time : '',
        'Course': userQuiz ? userQuiz.course : '',
        'Course Code': userQuiz ? userQuiz.courseCode : '',
      };
    }).filter(user => user['Quiz Name'] !== '');

    const ws = XLSX.utils.json_to_sheet(quizData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${quizName} Data`);
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAsExcelFile(excelBuffer, `${quizName} Data.xlsx`);
    toast.success(`${quizName} Data Downloaded Successfully!`);
  };

  const saveAsExcelFile = (buffer: any, fileName: string) => {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  return (
    <div className='  flex flex-col items-center justify-center  px-2 text-white min-h-screen my-[100px]'>
      <h1 className='text-3xl font-bold mb-6'>Admin Page</h1>
      {userData.length > 0 && quizData.length > 0 && (
        <div className="flex flex-wrap">
          {quizData
            .map((quiz: any, index: any) => (
              <div key={index} className="mr-4 mb-4">
                <button
                  onClick={() => handleLockUnlockQuiz(quiz)}
                  className={`bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 mb-4`}
                >
                  <FontAwesomeIcon icon={lockStatus[quiz] ? faLock : faUnlock} />
                </button>
                <button
                  onClick={() => handleDownloadQuiz(quiz)}
                  className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 mb-4`}
                >
                  <FontAwesomeIcon icon={faDownload} className="mr-2" />
                  "{quiz}" Data
                </button>
                <button
                  onClick={() => handleDeleteQuiz(quiz)}
                  className={`bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 mb-4`}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
        </div>
      )}
      <div className='flex items-center pace-x-4'>
        <button
          onClick={handleDownloadExcel}
          disabled={userData.length === 0}
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2`}
          style={{ height: '2.5rem' }}
        >
          Download All Quiz Data
        </button>
        <a
          href='/createquiz'
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2`}
          style={{ height: '2.5rem' }}
        >
          Create Quiz
        </a>
      </div>
      <table className='min-w-full  bg-gray-800 rounded-lg shadow-md mt-4'>
        <thead>
          <tr>
            <th className='border-b-2 p-4'>USN</th>
            <th className='border-b-2 p-4'>Email</th>
            <th className='border-b-2 p-4'>Display Name</th>
            <th className='border-b-2 p-4'>Quiz Data</th>
            <th className='border-b-2 p-4'>Total Score</th>
          </tr>
        </thead>
        <tbody>
          {userData.map((user: any) => (
            <tr key={user.uid} className='border-b-2'>
              <td className='p-4'>{user.USN}</td>
              <td className='p-4'>{user.email}</td>
              <td className='p-4'>{user.displayName}</td>
              <td className='p-4'>
                {user.quizData.map((quiz: any, index: any) => (
                  <div key={index} className='mb-4'>
                    <details className='mb-2'>
                      <summary className='text-xl font-semibold cursor-pointer'>
                        {quiz.quizName}: {quiz.score} / {quiz.totalQuestions}
                      </summary>
                      <QuizDetails quiz={quiz} />
                    </details>
                  </div>
                ))}
              </td>
              <td className='p-4'>{calculateTotalScore(user.quizData)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPage;
