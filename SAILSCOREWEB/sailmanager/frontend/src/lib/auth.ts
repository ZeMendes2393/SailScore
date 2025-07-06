import API from "./api";

export async function login(username: string, password: string) {
  const res = await API.post("/token", {
    username,
    password,
  });
  return res.data.access_token;
}

export async function register(username: string, password: string, role: string) {
  const res = await API.post("/register", {
    username,
    password,
    role,
  });
  return res.data;
}
