type SupabaseAuthState = {
  userId: string | null
  tenantId: string | null
  isAuthenticated: boolean
  isApproved: boolean
  isLoading: boolean
}

type AuthStateListener = (state: SupabaseAuthState) => void

let authState: SupabaseAuthState = {
  userId: null,
  tenantId: null,
  isAuthenticated: false,
  isApproved: false,
  isLoading: true,
}

const listeners = new Set<AuthStateListener>()

function notifyListeners() {
  for (const listener of listeners) {
    listener(authState)
  }
}

export function setSupabaseAuthState(nextState: SupabaseAuthState) {
  const changed =
    authState.userId !== nextState.userId ||
    authState.tenantId !== nextState.tenantId ||
    authState.isAuthenticated !== nextState.isAuthenticated ||
    authState.isApproved !== nextState.isApproved ||
    authState.isLoading !== nextState.isLoading

  if (!changed) return

  authState = nextState
  notifyListeners()
}

export function getSupabaseAuthState() {
  return authState
}

export function subscribeSupabaseAuthState(listener: AuthStateListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
