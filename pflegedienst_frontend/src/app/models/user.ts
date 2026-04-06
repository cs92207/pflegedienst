export class User {
    id:number = 0;
    name:string = "";
    email:string = "";
    role:'admin'|'user' = 'user';
    emailVerified: boolean = false;
    mustChangePassword: boolean = false;
}