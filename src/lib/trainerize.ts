import type { 
  TrainerizeExercise, 
  TrainerizeApiResponse, 
  TrainerizeApiError 
} from '@/types/trainerize'

class TrainerizeAPI {
  private baseUrl: string
  private groupId: string
  private apiToken: string
  private authHeader: string

  constructor() {
    this.baseUrl = process.env.TRAINERIZE_API_URL || 'https://api.trainerize.com/v03'
    this.groupId = process.env.TRAINERIZE_GROUP_ID || ''
    this.apiToken = process.env.TRAINERIZE_API_TOKEN || ''
    
    const credentials = `${this.groupId}:${this.apiToken}`
    this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': this.authHeader,
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {}
      throw new Error(errorMessage)
    }

    return response.json()
  }

  async getUsers(params?: {
    start?: number
    count?: number
    type?: 'client' | 'trainer'
  }): Promise<any> {
    return this.request('/user/getProfile', {
      method: 'POST',
      body: JSON.stringify({
        start: params?.start || 0,
        count: params?.count || 50,
        ...params
      })
    })
  }

  async getTrainingPlans(userID: number): Promise<any> {
    return this.request('/trainingPlan/getList', {
      method: 'POST',
      body: JSON.stringify({ userID })
    })
  }

  async getWorkouts(planID: number): Promise<any> {
    return this.request('/trainingPlan/getWorkoutDefList', {
      method: 'POST',
      body: JSON.stringify({ planID })
    })
  }

  async getCalendar(userID: number, startDate: string, endDate: string): Promise<any> {
    return this.request('/calendar/getList', {
      method: 'POST',
      body: JSON.stringify({
        userID,
        startDate,
        endDate,
        unitDistance: 'miles',
        unitWeight: 'lbs'
      })
    })
  }

  async getBodyStats(userID: number, date?: string): Promise<any> {
    return this.request('/bodystats/get', {
      method: 'POST',
      body: JSON.stringify({
        userID,
        date: date || new Date().toISOString().split('T')[0],
        unitWeight: 'lbs',
        unitBodystats: 'inches'
      })
    })
  }

  async addUser(userData: any): Promise<any> {
    return this.request('/user/add', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  async updateUserProfile(userData: any): Promise<any> {
    return this.request('/user/setProfile', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  async setUserStatus(userID: number, status: 'active' | 'inactive'): Promise<any> {
    return this.request('/user/setStatus', {
      method: 'POST',
      body: JSON.stringify({ userID, status })
    })
  }

  async getMessages(userID: number): Promise<any> {
    return this.request('/message/getThreads', {
      method: 'POST',
      body: JSON.stringify({
        userID,
        view: 'inbox',
        start: 0,
        count: 50
      })
    })
  }
}

export const trainerizeApi = new TrainerizeAPI()